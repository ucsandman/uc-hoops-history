import { redirect } from "next/navigation";

export const metadata = {
  title: "Hall • UC Hoops History",
  description: "Quick picks moved to the About page.",
};

export default function HallPage() {
  redirect("/about#quick-picks");
}
