import { CommunityHub } from "@/components/community-hub";

export const metadata = { title: "Community — EdgeLedger", description: "EdgeLedger social channels and admin-managed broker directory." };

export default function CommunityPage() {
  return <div className="container-shell py-12"><CommunityHub /></div>;
}
