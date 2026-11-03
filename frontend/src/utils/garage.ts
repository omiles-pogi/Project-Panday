/** "2-car garage" / "No garage"; null for plans saved before garages were planned (nothing to claim). */
export function garageLabel(cars: number | undefined): string | null {
  if (cars === undefined) return null;
  return cars > 0 ? `${cars}-car garage` : "No garage";
}
