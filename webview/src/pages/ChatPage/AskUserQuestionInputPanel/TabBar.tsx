import { QuestionItem } from './useFormState';

interface Props {
  questions: QuestionItem[];
  currentIndex: number;
  onTabClick: (idx: number) => void;
}

export const TabBar = (props: Props) => {
  const { questions, currentIndex, onTabClick } = props;

  return (
    <div className="flex gap-1 overflow-x-auto">
      {questions.map((q, idx) => (
        <button
          key={idx}
          onClick={() => onTabClick(idx)}
          className={`p-1 text-[0.9230rem] font-medium whitespace-nowrap border-b-2 transition-colors ${
            idx === currentIndex
              ? 'text-text-primary border-border-focus'
              : 'text-text-tertiary border-transparent hover:text-text-secondary'
          }`}
        >
          {q.header || q.question}
        </button>
      ))}
    </div>
  );
};
