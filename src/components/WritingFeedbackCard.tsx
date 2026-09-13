// Shared between the writing practice flow's immediate post-submit feedback screen and the
// writing entry detail/history page — same full breakdown in both places.

export type WritingFeedbackCardData = {
  clarityScore: number;
  tone: string;
  grammarCorrections: { original: string; corrected: string; explanation: string; errorType: string }[];
  sentenceSuggestions: string;
  vocabularySuggestions: string;
  newVocabulary: { word: string; definition: string; example: string }[];
  professionalVersion: string;
  strengths: string;
  weaknesses: string;
  actionItem: string;
};

export function WritingFeedbackCard({ feedback }: { feedback: WritingFeedbackCardData }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">Clarity score: {feedback.clarityScore}/100</p>

      <Section title="Tone">{feedback.tone}</Section>

      {feedback.grammarCorrections.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-semibold text-muted">Mistakes & corrections</p>
          <ul className="mt-2 flex flex-col gap-2 text-sm">
            {feedback.grammarCorrections.map((c, i) => (
              <li key={i}>
                <p>
                  <span className="text-danger line-through">{c.original}</span> →{" "}
                  <span className="text-accent">{c.corrected}</span>
                </p>
                <p className="text-xs text-muted">{c.explanation}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Section title="Sentence & phrasing suggestions">{feedback.sentenceSuggestions}</Section>
      <Section title="Vocabulary upgrades">{feedback.vocabularySuggestions}</Section>

      {feedback.newVocabulary.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-semibold text-muted">New vocabulary (added to your Vocabulary Bank)</p>
          <ul className="mt-2 flex flex-col gap-2 text-sm">
            {feedback.newVocabulary.map((v, i) => (
              <li key={i}>
                <span className="font-medium">{v.word}</span> — {v.definition}
              </li>
            ))}
          </ul>
        </div>
      )}

      <details className="rounded-xl border border-border bg-card p-4">
        <summary className="cursor-pointer text-sm font-semibold">Professional rewrite (for comparison)</summary>
        <p className="mt-2 whitespace-pre-wrap text-sm text-muted">{feedback.professionalVersion}</p>
      </details>

      <Section title="Strengths">{feedback.strengths}</Section>
      <Section title="Weaknesses">{feedback.weaknesses}</Section>
      <Section title="Focus for next time">{feedback.actionItem}</Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-semibold text-muted">{title}</p>
      <p className="mt-1 text-sm">{children}</p>
    </div>
  );
}
