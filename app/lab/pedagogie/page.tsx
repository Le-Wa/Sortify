import { notFound } from "next/navigation";
import { Board } from "./Board";

/** Planche de la pédagogie de l'onboarding (développement seulement). */
export default function PedagogiePage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <Board />;
}
