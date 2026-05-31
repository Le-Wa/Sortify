import PersonasClient from "./PersonasClient";

export default function PersonasPage() {
  if (process.env.NODE_ENV === "production") return null;
  return <PersonasClient />;
}
