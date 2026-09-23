import { useState } from "react";

type Role = "homeowner" | "contractor" | "supplier" | "worker";

interface LoginProps {
  onLogin: (role: Role) => void;
}

const roles = [
  { role: "homeowner" as const, label: "Homeowner", desc: "Plan, budget & monitor your project", icon: "🏠", color: "#3b82f6" },
  { role: "contractor" as const, label: "Contractor", desc: "Manage projects, workers & equipment", icon: "👷", color: "#10b981" },
  { role: "supplier" as const, label: "Supplier / Dealer", desc: "List materials & respond to bids", icon: "🏗️", color: "#8b5cf6" },
  { role: "worker" as const, label: "Skilled Worker", desc: "View assignments & track earnings", icon: "🔧", color: "#f43f5e" },
];

function Field({ label, type = "text", placeholder }: { label: string; type?: string; placeholder?: string }) {
  return (
    <div>
      <label className="block text-xs font-600 mb-1.5" style={{ color: "#9ca3af" }}>{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        className="w-full px-4 py-3.5 rounded-2xl text-base outline-none transition-all"
        style={{ background: "#1a1d27", border: "1px solid #2a2f42", color: "#f0f2f5", fontSize: 16 }}
        onFocus={e => (e.target.style.borderColor = "#f59e0b")}
        onBlur={e => (e.target.style.borderColor = "#2a2f42")}
      />
    </div>
  );
}

function SelectField({ label, options }: { label: string; options: string[] }) {
  return (
    <div>
      <label className="block text-xs font-600 mb-1.5" style={{ color: "#9ca3af" }}>{label}</label>
      <select
        className="w-full px-4 py-3.5 rounded-2xl text-base outline-none"
        style={{ background: "#1a1d27", border: "1px solid #2a2f42", color: "#f0f2f5", fontSize: 16 }}
        onFocus={e => (e.target.style.borderColor = "#f59e0b")}
        onBlur={e => (e.target.style.borderColor = "#2a2f42")}
      >
        {options.map(o => <option key={o}>{o}</option>)}
      </select>
    </div>
  );
}

function Logo() {
  return (
    <div className="flex flex-col items-center mb-8">
      <div className="w-14 h-14 rounded-3xl flex items-center justify-center mb-3" style={{ background: "#f59e0b" }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
          <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="#0f1117" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          <polyline points="9 22 9 12 15 12 15 22" stroke="#0f1117" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <h1 className="text-2xl font-800" style={{ color: "#f0f2f5" }}>BuildAI</h1>
      <p className="text-xs" style={{ color: "#6b7280" }}>AI-Powered Construction Management</p>
    </div>
  );
}

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-1.5 mb-6">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className="rounded-full transition-all"
          style={{ width: i === current ? 20 : 6, height: 6, background: i <= current ? "#f59e0b" : "#2a2f42" }}
        />
      ))}
    </div>
  );
}

// Role-specific credential fields
function HomeownerFields() {
  return (
    <>
      <Field label="Property / Project Address" placeholder="e.g. 123 Rizal Ave, Quezon City" />
      <SelectField label="Project Type" options={["New House Construction", "Renovation / Remodeling", "Extension / Addition", "Commercial Build", "Other"]} />
      <SelectField label="Estimated Budget Range" options={["Below ₱500,000", "₱500K – ₱1M", "₱1M – ₱2.5M", "₱2.5M – ₱5M", "Above ₱5M"]} />
      <Field label="Target Start Date" type="date" />
    </>
  );
}

function ContractorFields() {
  return (
    <>
      <Field label="Company / Firm Name" placeholder="e.g. Santos Construction Co." />
      <Field label="PCAB License Number" placeholder="e.g. PCAB-2024-12345" />
      <SelectField label="Primary Specialization" options={["General Construction", "Structural / Foundation", "Electrical Works", "Plumbing & Sanitation", "Roofing & Waterproofing", "Finishing & Interior", "Heavy Equipment"]} />
      <Field label="Years in Business" type="number" placeholder="e.g. 8" />
      <Field label="DTI / SEC Registration No." placeholder="e.g. DTI-2018-XXXXX" />
      <SelectField label="Maximum Project Size" options={["Below ₱500K", "₱500K – ₱2M", "₱2M – ₱10M", "Above ₱10M"]} />
    </>
  );
}

function SupplierFields() {
  return (
    <>
      <Field label="Company / Business Name" placeholder="e.g. Metro Hardware Supply" />
      <Field label="TIN / Business Reg. No." placeholder="e.g. 123-456-789-000" />
      <SelectField label="Primary Product Category" options={["Cement & Concrete", "Steel & Structural", "Lumber & Wood", "Electrical Supplies", "Plumbing Materials", "Tiles & Finishing", "Aggregates & Gravel", "General Hardware"]} />
      <Field label="Delivery Areas / Covered Cities" placeholder="e.g. Metro Manila, Bulacan, Laguna" />
      <SelectField label="Delivery Capability" options={["Within 20km", "Within 50km", "Metro Manila Only", "Nationwide"]} />
      <Field label="Mayor's Permit / Business License No." placeholder="e.g. BP-2024-00123" />
    </>
  );
}

function WorkerFields() {
  return (
    <>
      <SelectField label="Primary Trade / Skill" options={["Mason / Block Layer", "Carpenter / Formwork", "Electrician", "Plumber", "Welder / Steel Worker", "Painter", "Tile Setter", "Roofer", "Laborer / General Worker", "Heavy Equipment Operator"]} />
      <Field label="Years of Experience" type="number" placeholder="e.g. 5" />
      <Field label="TESDA NC II Certificate No. (if any)" placeholder="e.g. TESDA-NC2-2021-XXXXX" />
      <SelectField label="Preferred Daily Rate" options={["₱400 – ₱600 /day", "₱600 – ₱800 /day", "₱800 – ₱1,000 /day", "₱1,000 – ₱1,500 /day", "Above ₱1,500 /day"]} />
      <Field label="City / Municipality of Residence" placeholder="e.g. Quezon City" />
      <SelectField label="Availability" options={["Available Now", "Available in 2 weeks", "Available Next Month", "On a Project (Open to New)"]} />
    </>
  );
}

export default function Login({ onLogin }: LoginProps) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  // signup steps: 0 = basic info, 1 = role pick, 2 = role credentials
  const [signupStep, setSignupStep] = useState(0);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);

  const handleSignIn = () => onLogin("homeowner");

  const handleCreateAccount = () => {
    if (selectedRole) onLogin(selectedRole);
  };

  if (mode === "signup") {
    return (
      <div className="min-h-screen flex flex-col px-5 py-8 scroll-area" style={{ background: "#0f1117" }}>
        <div className="w-full pb-10" style={{ maxWidth: 440, margin: "0 auto" }}>
          <Logo />
          <StepDots current={signupStep} total={3} />

          {signupStep === 0 && (
            <>
              <h2 className="text-xl font-800 mb-0.5" style={{ color: "#f0f2f5" }}>Create Account</h2>
              <p className="text-xs mb-5" style={{ color: "#6b7280" }}>Start your construction management journey</p>
              <div className="space-y-3.5">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="First Name" placeholder="Juan" />
                  <Field label="Last Name" placeholder="Dela Cruz" />
                </div>
                <Field label="Email Address" type="email" placeholder="juan@example.com" />
                <Field label="Mobile Number" type="tel" placeholder="+63 9XX XXX XXXX" />
                <Field label="Password" type="password" placeholder="Min. 8 characters" />
                <Field label="Confirm Password" type="password" placeholder="Re-enter password" />
                <button
                  onClick={() => setSignupStep(1)}
                  className="w-full py-4 rounded-2xl font-700 text-base transition-all active:scale-[0.98] mt-2"
                  style={{ background: "#f59e0b", color: "#0f1117" }}
                >
                  Next — Select Role
                </button>
                <p className="text-center text-xs pt-1" style={{ color: "#6b7280" }}>
                  Already have an account?{" "}
                  <button onClick={() => setMode("login")} className="font-600" style={{ color: "#f59e0b" }}>Sign in</button>
                </p>
              </div>
            </>
          )}

          {signupStep === 1 && (
            <>
              <h2 className="text-xl font-800 mb-0.5" style={{ color: "#f0f2f5" }}>Select Your Role</h2>
              <p className="text-xs mb-5" style={{ color: "#6b7280" }}>Choose how you'll use BuildAI — you can only have one role per account</p>
              <div className="space-y-3 mb-5">
                {roles.map(({ role, label, desc, icon, color }) => {
                  const isSelected = selectedRole === role;
                  return (
                    <button
                      key={role}
                      onClick={() => setSelectedRole(role)}
                      className="w-full text-left p-4 rounded-2xl transition-all active:scale-[0.98]"
                      style={{
                        background: isSelected ? color + "18" : "#1a1d27",
                        border: `2px solid ${isSelected ? color : "#2a2f42"}`,
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl flex-shrink-0" style={{ background: color + "20" }}>{icon}</div>
                        <div className="flex-1 min-w-0">
                          <div className="font-700 text-sm mb-0.5" style={{ color: "#f0f2f5" }}>{label}</div>
                          <div className="text-xs leading-relaxed" style={{ color: "#6b7280" }}>{desc}</div>
                        </div>
                        <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                          style={{ borderColor: isSelected ? color : "#374151", background: isSelected ? color : "transparent" }}>
                          {isSelected && <div className="w-2 h-2 rounded-full" style={{ background: "#fff" }} />}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setSignupStep(0)} className="flex-1 py-3.5 rounded-2xl font-600 text-sm" style={{ background: "#1a1d27", border: "1px solid #2a2f42", color: "#9ca3af" }}>
                  Back
                </button>
                <button
                  onClick={() => { if (selectedRole) setSignupStep(2); }}
                  className="flex-[2] py-3.5 rounded-2xl font-700 text-sm transition-all active:scale-[0.98]"
                  style={{ background: selectedRole ? "#f59e0b" : "#252a3a", color: selectedRole ? "#0f1117" : "#6b7280" }}
                >
                  Next — Add Credentials
                </button>
              </div>
            </>
          )}

          {signupStep === 2 && selectedRole && (
            <>
              {(() => {
                const r = roles.find(r => r.role === selectedRole)!;
                return (
                  <>
                    <div className="flex items-center gap-3 mb-5">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background: r.color + "20" }}>{r.icon}</div>
                      <div>
                        <h2 className="text-xl font-800 leading-tight" style={{ color: "#f0f2f5" }}>{r.label} Details</h2>
                        <p className="text-xs" style={{ color: "#6b7280" }}>Verify your credentials to complete signup</p>
                      </div>
                    </div>
                    <div className="space-y-3.5 mb-5">
                      {selectedRole === "homeowner" && <HomeownerFields />}
                      {selectedRole === "contractor" && <ContractorFields />}
                      {selectedRole === "supplier" && <SupplierFields />}
                      {selectedRole === "worker" && <WorkerFields />}
                    </div>
                    <div className="rounded-xl px-4 py-3 mb-5 flex gap-2 items-start" style={{ background: "#f59e0b15", border: "1px solid #f59e0b30" }}>
                      <span className="text-sm flex-shrink-0">🔒</span>
                      <p className="text-xs leading-relaxed" style={{ color: "#fbbf24" }}>
                        Your credentials are verified against government databases (PCAB, TESDA, DTI, BIR) and reviewed within 24–48 hours.
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <button onClick={() => setSignupStep(1)} className="flex-1 py-3.5 rounded-2xl font-600 text-sm" style={{ background: "#1a1d27", border: "1px solid #2a2f42", color: "#9ca3af" }}>
                        Back
                      </button>
                      <button
                        onClick={handleCreateAccount}
                        className="flex-[2] py-3.5 rounded-2xl font-700 text-sm transition-all active:scale-[0.98]"
                        style={{ background: "#f59e0b", color: "#0f1117" }}
                      >
                        Create Account
                      </button>
                    </div>
                    <p className="text-center text-xs mt-4" style={{ color: "#6b7280" }}>
                      By creating an account you agree to our{" "}
                      <span className="font-600" style={{ color: "#f59e0b" }}>Terms & Privacy Policy</span>
                    </p>
                  </>
                );
              })()}
            </>
          )}
        </div>
      </div>
    );
  }

  // Login screen
  return (
    <div className="min-h-screen flex flex-col px-5 py-8" style={{ background: "#0f1117" }}>
      <div className="flex-1 flex flex-col justify-center w-full" style={{ maxWidth: 440, margin: "0 auto" }}>
        <Logo />
        <h2 className="text-2xl font-800 mb-0.5" style={{ color: "#f0f2f5" }}>Welcome back</h2>
        <p className="text-sm mb-6" style={{ color: "#6b7280" }}>Sign in to continue</p>

        <div className="space-y-4">
          <Field label="Email Address" type="email" placeholder="you@example.com" />
          <Field label="Password" type="password" placeholder="••••••••" />

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 rounded accent-amber-400" />
              <span className="text-sm" style={{ color: "#9ca3af" }}>Remember me</span>
            </label>
            <button className="text-sm font-600" style={{ color: "#f59e0b" }}>Forgot password?</button>
          </div>

          <button
            onClick={handleSignIn}
            className="w-full py-4 rounded-2xl font-700 text-base transition-all active:scale-[0.98]"
            style={{ background: "#f59e0b", color: "#0f1117" }}
          >
            Sign In
          </button>

          <div className="relative flex items-center gap-3 py-1">
            <div className="flex-1 h-px" style={{ background: "#2a2f42" }} />
            <span className="text-xs" style={{ color: "#374151" }}>or</span>
            <div className="flex-1 h-px" style={{ background: "#2a2f42" }} />
          </div>

          <button
            onClick={() => { setMode("signup"); setSignupStep(0); setSelectedRole(null); }}
            className="w-full py-4 rounded-2xl font-700 text-base transition-all active:scale-[0.98]"
            style={{ background: "#1a1d27", border: "2px solid #f59e0b", color: "#f59e0b" }}
          >
            Create New Account
          </button>
        </div>
      </div>
    </div>
  );
}
