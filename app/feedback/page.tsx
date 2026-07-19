import { FeedbackForm } from "@/components/feedback-form";

export const metadata = {
  title: "Feedback — EdgeLedger",
  description: "Share product feedback, ideas, media, and documents with EdgeLedger.",
};

export default function FeedbackPage() {
  return (
    <div className="container-shell py-16">
      <div className="mb-10 max-w-2xl">
        <div className="eyebrow">Feedback desk</div>
        <h1 className="mt-4 font-display text-5xl font-semibold tracking-[-.04em]">Help shape EdgeLedger.</h1>
        <p className="mt-5 text-sm leading-7 text-muted">Send feedback in the format that explains it best—write a message or attach images, audio, video, and documents.</p>
      </div>
      <FeedbackForm />
    </div>
  );
}
