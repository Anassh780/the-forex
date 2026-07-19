import { SupportCenter } from "@/components/support-center";

export const metadata = {
  title: "Help & Support — EdgeLedger",
  description: "Find answers or contact EdgeLedger support with text and media attachments.",
};

export default function SupportPage() {
  return <div className="container-shell py-12"><SupportCenter /></div>;
}
