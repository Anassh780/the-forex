import { redirect } from "next/navigation";

/** Legacy demo route — all course content lives in the Drive-backed library. */
export default function MarketStructureRedirect() {
  redirect("/courses");
}
