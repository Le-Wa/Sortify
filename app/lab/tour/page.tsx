import { notFound } from "next/navigation";
import { tourDesBacs } from "@/lib/potes";
import { TourDesBacs } from "../../(app)/potes/Tour";

/** Planche vivante du tour des bacs (développement seulement, lecture seule) : `?me=<spotify id>&now=<date ISO>`. */
export default async function TourLab(props: PageProps<"/lab/tour">) {
  if (process.env.NODE_ENV === "production") notFound();
  const { me, now } = await props.searchParams;
  const tour = await tourDesBacs(typeof me === "string" ? me : "1156097412", typeof now === "string" ? new Date(now) : new Date());
  return <main className="page page--bare">{tour ? <TourDesBacs tour={tour} /> : <p>Ce membre ne partage pas ses bacs.</p>}</main>;
}
