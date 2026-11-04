import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Badge, Card, InfoBox, MONO, ProgressBar, StatGrid, StatTile } from "@/components/ui";
import { GrowBar } from "@/components/charts";
import { useTheme } from "@/context/ThemeContext";
import { fetchProjectTimeline } from "@/services/api/timeline";
import { useFocusedResource } from "@/hooks/useFocusedResource";
import type { ProjectTimeline, TimelineMonth, TimelineTask } from "@/types/timeline";
import {
  PHASE_STATUS_META,
  SCHEDULE_STATUS_META,
  TASK_STATUS_META,
  buildMonthGrid,
  dayDotColor,
  defaultMonthKey,
  formatRange,
  formatShortDate,
} from "@/utils/timeline";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const CHART_HEIGHT = 90;
const PLANNED_COLOR = "#6b7280";
const ACTUAL_COLOR = "#f59e0b";

/**
 * Calendar-based project monitoring, as a section of the homeowner's and contractor's dashboards (the
 * only two roles the backend lets see it): the AI-proposed schedule month by month, and how real
 * progress compares with it. Mount it with `key={projectId}` so switching projects starts clean.
 *
 * `showPhases` adds the phase-by-phase schedule card; pass false where the dashboard already lists
 * the project's phases.
 */
export default function ProjectCalendar({ projectId, showPhases = true }: { projectId: number; showPhases?: boolean }) {
  const [monthKey, setMonthKey] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const load = useCallback(() => fetchProjectTimeline(projectId), [projectId]);
  const { data: timeline, loading, error } = useFocusedResource(load);
  useEffect(() => {
    if (!timeline) return;
    // Preserve the chosen month while fresh progress arrives from the backend.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMonthKey((current) => current && timeline.months.some((month) => month.key === current) ? current : defaultMonthKey(timeline.months));
  }, [timeline]);

  const pickMonth = (key: string) => {
    setMonthKey(key);
    setSelectedDay(null);
  };

  const monthIndex = timeline ? timeline.months.findIndex((m) => m.key === monthKey) : -1;
  const month = timeline && monthIndex >= 0 ? timeline.months[monthIndex] : null;

  return (
    <View style={{ gap: 16 }}>
      <View className="flex-row items-center gap-2">
        <Ionicons name="calendar-outline" size={16} color="#f59e0b" />
        <Text className="font-bold text-sm text-foreground">Project Calendar</Text>
      </View>

      {error && (
        <InfoBox color="#ef4444" title="Couldn't load the calendar">
          {error}
        </InfoBox>
      )}

      {loading && !timeline && <ActivityIndicator color="#f59e0b" style={{ marginVertical: 24 }} />}

      {timeline && (
        <>
          <ScheduleSummary timeline={timeline} />
          <MonthlyChart timeline={timeline} selectedKey={monthKey} onSelect={pickMonth} />
          {month && (
            <MonthCalendar
              timeline={timeline}
              month={month}
              hasPrev={monthIndex > 0}
              hasNext={monthIndex < timeline.months.length - 1}
              onPrev={() => pickMonth(timeline.months[monthIndex - 1].key)}
              onNext={() => pickMonth(timeline.months[monthIndex + 1].key)}
              selectedDay={selectedDay}
              onSelectDay={setSelectedDay}
            />
          )}
          {showPhases && <PhaseSchedule timeline={timeline} />}
        </>
      )}
    </View>
  );
}

function ScheduleSummary({ timeline }: { timeline: ProjectTimeline }) {
  const { overall } = timeline;
  const meta = SCHEDULE_STATUS_META[overall.status];
  const gap = Math.abs(overall.variancePct);
  const runningLabel =
    overall.status === "completed"
      ? null
      : overall.daysRemaining >= 0
        ? `${overall.daysRemaining} day${overall.daysRemaining === 1 ? "" : "s"} left in the plan`
        : `${-overall.daysRemaining} day${overall.daysRemaining === -1 ? "" : "s"} past the planned end`;

  return (
    <>
      <InfoBox color={meta.color}>
        <Text className="text-xl font-extrabold" style={{ color: meta.color }}>
          {meta.label}
        </Text>
        <Text className="text-sm mt-1 text-secondary-foreground">{meta.summary(gap)}</Text>
        <Text className="text-xs mt-2 text-muted-foreground">
          AI schedule: {formatRange(timeline.startDate, timeline.endDate)} · {timeline.timelineMonths} month
          {timeline.timelineMonths === 1 ? "" : "s"}
          {runningLabel ? ` · ${runningLabel}` : ""}
        </Text>
      </InfoBox>

      <Card title="Planned vs Actual Progress" gap={14}>
        <ProgressRow label="Planned by today" pct={overall.plannedPct} color={PLANNED_COLOR} />
        <ProgressRow label="Actual progress" pct={overall.actualPct} color={meta.color === "#6b7280" ? ACTUAL_COLOR : meta.color} />
      </Card>

      <StatGrid>
        <StatTile label="Tasks done" value={`${overall.tasks.done}/${overall.tasks.total}`} icon="checkmark-done-outline" color="#10b981" />
        <StatTile
          label="Overdue tasks"
          value={overall.tasks.overdue}
          icon="alert-circle-outline"
          color={overall.tasks.overdue > 0 ? "#ef4444" : "#6b7280"}
        />
      </StatGrid>
    </>
  );
}

function ProgressRow({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <View>
      <View className="flex-row justify-between mb-2">
        <Text className="text-xs text-secondary-foreground">{label}</Text>
        <Text className="text-xs font-semibold" style={{ color, fontFamily: MONO }}>
          {pct}%
        </Text>
      </View>
      <ProgressBar pct={pct} color={color} height={12} />
    </View>
  );
}

/** Cumulative planned vs actual progress at the end of each month; tap a column to open that month. */
function MonthlyChart({
  timeline,
  selectedKey,
  onSelect,
}: {
  timeline: ProjectTimeline;
  selectedKey: string | null;
  onSelect: (key: string) => void;
}) {
  const { chrome } = useTheme();
  return (
    <Card
      title="Month by Month"
      right={
        <View className="flex-row gap-3">
          <Legend color={PLANNED_COLOR} label="Planned" />
          <Legend color={ACTUAL_COLOR} label="Actual" />
        </View>
      }
    >
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View className="flex-row" style={{ gap: 6 }}>
          {timeline.months.map((m, i) => {
            const selected = m.key === selectedKey;
            return (
              <Pressable
                key={m.key}
                onPress={() => onSelect(m.key)}
                className="items-center rounded-xl px-2 py-2"
                style={{ width: 52, backgroundColor: selected ? "#f59e0b20" : "transparent" }}
                accessibilityLabel={`${m.label}: planned ${m.plannedPct}%, actual ${m.actualPct ?? "not yet"}%`}
              >
                <Text className="text-xs mb-1" style={{ color: chrome.mutedForeground, fontFamily: MONO }}>
                  {m.actualPct ?? m.plannedPct}%
                </Text>
                <View className="flex-row items-end" style={{ height: CHART_HEIGHT, gap: 3 }}>
                  <GrowBar
                    height={Math.max(2, (m.plannedPct / 100) * CHART_HEIGHT)}
                    color={PLANNED_COLOR}
                    delay={i * 60}
                    className="w-3 rounded-t-sm"
                  />
                  <GrowBar
                    height={m.actualPct === null ? 0 : Math.max(2, (m.actualPct / 100) * CHART_HEIGHT)}
                    color={ACTUAL_COLOR}
                    delay={i * 60 + 30}
                    className="w-3 rounded-t-sm"
                  />
                </View>
                <Text className="text-xs mt-1 font-semibold" style={{ color: selected ? "#f59e0b" : chrome.mutedForeground }}>
                  {monthShort(m)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </Card>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View className="flex-row items-center gap-1">
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Text className="text-xs text-muted-foreground">{label}</Text>
    </View>
  );
}

function monthShort(m: TimelineMonth): string {
  return new Date(m.year, m.month - 1, 1).toLocaleDateString(undefined, { month: "short" });
}

function MonthCalendar({
  timeline,
  month,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  selectedDay,
  onSelectDay,
}: {
  timeline: ProjectTimeline;
  month: TimelineMonth;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  selectedDay: string | null;
  onSelectDay: (iso: string | null) => void;
}) {
  const { chrome } = useTheme();
  const rows = buildMonthGrid(month);
  const visibleTasks = selectedDay ? month.tasks.filter((t) => t.plannedEnd === selectedDay) : month.tasks;

  return (
    <>
      <Card>
        <View className="flex-row items-center justify-between mb-3">
          <Pressable onPress={onPrev} disabled={!hasPrev} hitSlop={10} accessibilityLabel="Previous month">
            <Ionicons name="chevron-back" size={20} color={hasPrev ? chrome.foreground : chrome.border} />
          </Pressable>
          <Text className="font-bold text-base text-foreground">{month.label}</Text>
          <Pressable onPress={onNext} disabled={!hasNext} hitSlop={10} accessibilityLabel="Next month">
            <Ionicons name="chevron-forward" size={20} color={hasNext ? chrome.foreground : chrome.border} />
          </Pressable>
        </View>

        <View className="flex-row mb-1">
          {WEEKDAYS.map((d, i) => (
            <Text key={i} className="flex-1 text-center text-xs text-muted-foreground">
              {d}
            </Text>
          ))}
        </View>

        {rows.map((row, r) => (
          <View key={r} className="flex-row">
            {row.map((cell, c) => {
              if (!cell) return <View key={c} style={{ flex: 1, height: 44 }} />;
              const isToday = cell.iso === timeline.today;
              const selected = cell.iso === selectedDay;
              const hasTasks = cell.tasks.length > 0;
              return (
                <Pressable
                  key={c}
                  disabled={!hasTasks}
                  onPress={() => onSelectDay(selected ? null : cell.iso)}
                  style={{ flex: 1, height: 44, alignItems: "center", justifyContent: "center", padding: 2 }}
                  accessibilityLabel={`${cell.iso}${hasTasks ? `, ${cell.tasks.length} task${cell.tasks.length === 1 ? "" : "s"} due` : ""}`}
                >
                  <View
                    style={{
                      width: 34,
                      height: 38,
                      borderRadius: 12,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: selected ? "#f59e0b" : "transparent",
                      borderWidth: isToday ? 1.5 : 0,
                      borderColor: "#f59e0b",
                    }}
                  >
                    <Text
                      className="text-xs font-semibold"
                      style={{ color: selected ? "#0f1117" : isToday ? "#f59e0b" : chrome.foreground }}
                    >
                      {cell.day}
                    </Text>
                    <View style={{ height: 6, marginTop: 2, justifyContent: "center" }}>
                      {hasTasks ? (
                        <View
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: 3,
                            backgroundColor: selected ? "#0f1117" : dayDotColor(cell.tasks),
                          }}
                        />
                      ) : null}
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}

        <View className="flex-row flex-wrap gap-x-4 gap-y-1 mt-3">
          <Legend color="#10b981" label="Done" />
          <Legend color="#f59e0b" label="Pending / late" />
          <Legend color="#ef4444" label="Overdue" />
        </View>
      </Card>

      <Card title={selectedDay ? `Due ${formatShortDate(selectedDay)}` : `Scheduled in ${month.label}`} gap={10}>
        <View className="flex-row justify-between">
          <Text className="text-xs text-muted-foreground">Planned by month end</Text>
          <Text className="text-xs font-semibold" style={{ color: PLANNED_COLOR, fontFamily: MONO }}>
            {month.plannedPct}%
          </Text>
        </View>
        <View className="flex-row justify-between">
          <Text className="text-xs text-muted-foreground">{month.isCurrent ? "Actual so far" : "Actual by month end"}</Text>
          <Text className="text-xs font-semibold" style={{ color: ACTUAL_COLOR, fontFamily: MONO }}>
            {month.actualPct === null ? "—" : `${month.actualPct}%`}
          </Text>
        </View>

        {!selectedDay && month.phases.length > 0 && (
          <View className="flex-row flex-wrap gap-2">
            {month.phases.map((p) => (
              <Badge key={p.id} label={p.name} color="#3b82f6" />
            ))}
          </View>
        )}

        {visibleTasks.length === 0 ? (
          <Text className="text-xs text-muted-foreground">
            {selectedDay ? "Nothing is due on this day." : "No checklist items are due this month."}
          </Text>
        ) : (
          visibleTasks.map((task) => <TaskRow key={task.id} task={task} />)
        )}
      </Card>
    </>
  );
}

function TaskRow({ task }: { task: TimelineTask }) {
  const meta = TASK_STATUS_META[task.status];
  return (
    <View className="flex-row items-center gap-2.5 px-3 py-2 rounded-xl bg-muted">
      <Ionicons name={meta.icon} size={18} color={meta.color} />
      <View className="flex-1">
        <Text className="text-xs font-medium text-foreground" numberOfLines={2}>
          {task.description}
        </Text>
        <Text className="text-xs text-muted-foreground" numberOfLines={1}>
          {task.phaseName} · due {formatShortDate(task.plannedEnd)}
          {task.completedAt ? ` · done ${formatShortDate(task.completedAt)}` : ""}
        </Text>
      </View>
      <Badge label={meta.label} color={meta.color} />
    </View>
  );
}

function PhaseSchedule({ timeline }: { timeline: ProjectTimeline }) {
  return (
    <Card title="AI-Proposed Schedule" gap={16}>
      {timeline.phases.map((phase) => {
        const meta = PHASE_STATUS_META[phase.status];
        return (
          <View key={phase.id}>
            <View className="flex-row items-center justify-between mb-1">
              <Text className="flex-1 text-sm font-semibold text-foreground" numberOfLines={1}>
                {phase.name}
              </Text>
              <Badge label={meta.label} color={meta.color} />
            </View>
            <Text className="text-xs mb-2 text-muted-foreground">
              {formatRange(phase.startDate, phase.endDate)} · {phase.durationWeeks} wk{phase.durationWeeks === 1 ? "" : "s"} ·{" "}
              {phase.tasksDone}/{phase.taskCount} tasks
            </Text>
            <ProgressBar pct={phase.progressPct} color={phase.status === "overdue" ? "#ef4444" : meta.color === "#6b7280" ? ACTUAL_COLOR : meta.color} />
            <Text className="text-xs mt-1 text-muted-foreground">
              {phase.progressPct}% done · {phase.plannedPct}% planned by today
            </Text>
          </View>
        );
      })}
      <Text className="text-xs text-muted-foreground">
        The schedule is an AI-generated proposal; the contractor makes all operational decisions.
      </Text>
    </Card>
  );
}
