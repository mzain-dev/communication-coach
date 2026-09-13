// Shared between the live call's post-session screen (LiveCallClient) and the speaking session
// detail/history page — same full breakdown in both places, so viewing a past session later
// shows everything the student saw right after the call, not just a stripped-down summary.

export type FeedbackCardData = {
  overallScore: number;
  fluency: string;
  grammarAccuracy: string;
  vocabularyLevel: string;
  confidenceTone: string;
  strengths: string;
  weaknesses: string;
  actionItem: string;
  correctedExamples: { original: string; corrected: string }[];
  grammarErrors: { errorType: string; example: string }[];
  newVocabulary: { word: string; definition: string; example: string }[];
};

export function FeedbackCard({ feedback }: { feedback: FeedbackCardData }) {
  return (
    <div className="w-full max-w-sm rounded-xl border border-border bg-card p-4 text-left text-foreground">
      <p className="text-sm font-semibold">Overall score: {feedback.overallScore}/100</p>
      <Detail label="Fluency" value={feedback.fluency} />
      <Detail label="Grammar" value={feedback.grammarAccuracy} />
      <Detail label="Vocabulary" value={feedback.vocabularyLevel} />
      <Detail label="Confidence & tone" value={feedback.confidenceTone} />
      <Detail label="Strengths" value={feedback.strengths} />
      <Detail label="Weaknesses" value={feedback.weaknesses} />
      {feedback.correctedExamples.length > 0 && (
        <div className="mt-2">
          <p className="text-xs font-semibold text-muted">Mistakes & corrections</p>
          <ul className="mt-1 flex flex-col gap-1 text-sm">
            {feedback.correctedExamples.map((ex, i) => (
              <li key={i}>
                <span className="text-danger line-through">{ex.original}</span> →{" "}
                <span className="text-accent">{ex.corrected}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {feedback.grammarErrors.length > 0 && (
        <div className="mt-2">
          <p className="text-xs font-semibold text-muted">Recurring mistake types</p>
          <ul className="mt-1 flex flex-col gap-1 text-sm">
            {feedback.grammarErrors.map((g, i) => (
              <li key={i}>
                <span className="font-medium capitalize">{g.errorType}:</span> {g.example}
              </li>
            ))}
          </ul>
        </div>
      )}
      {feedback.newVocabulary.length > 0 && (
        <div className="mt-2">
          <p className="text-xs font-semibold text-muted">New vocabulary (added to your Vocabulary Bank)</p>
          <ul className="mt-1 flex flex-col gap-1 text-sm">
            {feedback.newVocabulary.map((v, i) => (
              <li key={i}>
                <span className="font-medium">{v.word}</span> — {v.definition}
              </li>
            ))}
          </ul>
        </div>
      )}
      <Detail label="Focus for next time" value={feedback.actionItem} />
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-2">
      <p className="text-xs font-semibold text-muted">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  );
}
