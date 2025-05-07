"use client";

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";

// Mock categories
const MOCK_CATEGORIES = [
  { id: 'adult', name: 'Adult' },
  { id: 'pediatric', name: 'Pediatric' },
  { id: 'medical', name: 'Medical' },
  { id: 'trauma', name: 'Trauma' },
];

interface Question {
  id: string;
  questionText: string;
  options: { id: string; text: string }[];
  correctAnswerId: string;
  explanation: string;
}

interface UserAnswer {
  questionId: string;
  selectedAnswerId: string;
  isCorrect: boolean;
}

export default function QuizPage() {
  const [quizState, setQuizState] = useState<'setup' | 'in-progress' | 'completed'>('setup');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [questionCount, setQuestionCount] = useState<number>(5);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string>('');
  const [showFeedback, setShowFeedback] = useState(false);
  const [userAnswers, setUserAnswers] = useState<UserAnswer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleCategory = (id: string) => {
    setSelectedCategories(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  };

  const startQuiz = async () => {
    if (selectedCategories.length === 0) { setError('Please select at least one category'); return; }
    setError(null);
    setIsLoading(true);
    try {
      const res = await fetch('/api/quiz/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categories: selectedCategories, length: questionCount }),
      });
      const data = await res.json();
      if (data.questions) { setQuestions(data.questions); setQuizState('in-progress'); }
      else { setError('Failed to load questions'); }
    } catch { setError('Error generating quiz'); }
    setIsLoading(false);
  };

  const submitAnswer = () => {
    const q = questions[currentIndex];
    const isCorrect = selectedOption === q.correctAnswerId;
    setUserAnswers(prev => [...prev, { questionId: q.id, selectedAnswerId: selectedOption, isCorrect }]);
    setShowFeedback(true);
  };

  const nextStep = () => {
    setShowFeedback(false);
    setSelectedOption('');
    if (currentIndex + 1 < questions.length) { setCurrentIndex(i => i + 1); }
    else { setQuizState('completed'); }
  };

  const resetQuiz = () => {
    setQuizState('setup'); setSelectedCategories([]); setQuestionCount(5);
    setQuestions([]); setCurrentIndex(0); setUserAnswers([]);
    setSelectedOption(''); setShowFeedback(false); setError(null);
  };

  let screen: React.ReactNode;

  if (quizState === 'setup') {
    screen = (
      <div className="p-6 max-w-md mx-auto text-white">
        <h1 className="text-2xl font-bold mb-4">Setup Quiz</h1>
        {error && <p className="mb-2 text-red-400">{error}</p>}
        <div className="mb-4">
          <p className="mb-2">Select Categories:</p>
          {MOCK_CATEGORIES.map(c => (
            <label key={c.id} className="flex items-center mb-1">
              <input type="checkbox" checked={selectedCategories.includes(c.id)} onChange={() => toggleCategory(c.id)} className="mr-2" />
              <span>{c.name}</span>
            </label>
          ))}
        </div>
        <div className="mb-4">
          <label className="block mb-1">Number of Questions:</label>
          <input type="number" min={1} max={20} value={questionCount} onChange={e => setQuestionCount(Number(e.target.value))} className="w-full p-2 rounded border" />
        </div>
        <Button onClick={startQuiz} disabled={isLoading} className="w-full">{isLoading ? 'Loading...' : 'Start Quiz'}</Button>
      </div>
    );
  } else if (quizState === 'in-progress') {
    const q = questions[currentIndex];
    screen = (
      <div className="p-6 max-w-md mx-auto text-white">
        <div className="flex justify-between mb-4">
          <h2 className="font-semibold">Question {currentIndex + 1} / {questions.length}</h2>
          <Progress value={((currentIndex + 1) / questions.length) * 100} />
        </div>
        <p className="mb-4">{q.questionText}</p>
        <RadioGroup value={selectedOption} onValueChange={setSelectedOption} className="mb-4">
          {q.options.map(opt => (
            <label key={opt.id} className="flex items-center mb-2">
              <RadioGroupItem value={opt.id} className="mr-2" />
              <span>{opt.text}</span>
            </label>
          ))}
        </RadioGroup>
        {showFeedback ? (
          <> 
            <p className="mb-2">{q.explanation}</p>
            <Button onClick={nextStep} className="w-full">{currentIndex + 1 < questions.length ? 'Next' : 'Finish'}</Button>
          </>
        ) : (
          <Button onClick={submitAnswer} disabled={!selectedOption} className="w-full">Submit</Button>
        )}
      </div>
    );
  } else {
    // completed
    const correctCount = userAnswers.filter(a => a.isCorrect).length;
    screen = (
      <div className="p-6 max-w-md mx-auto text-white">
        <h1 className="text-2xl font-bold mb-4">Quiz Complete!</h1>
        <p className="mb-4">Score: {correctCount} / {questions.length}</p>
        <Button onClick={resetQuiz} className="w-full">Restart</Button>
      </div>
    );
  }

  return <>{screen}</>;
}
