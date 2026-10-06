import Mascot from "@/components/Mascot";

// The app's brand mark is Pandy the mascot.
export default function Logo({ size = 96 }: { size?: number }) {
  return <Mascot size={size} />;
}
