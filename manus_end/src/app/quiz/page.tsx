"use client";

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { Progress } from "@/components/ui/progress";

// Mocked protocol categories for now - will be dynamic later
const MOCK_CATEGORIES = [
  { id: "adult", name: "Adult" },
  { id: "pediatric", name: "Pediatric" },
  { id: "medical", name: "Medical" },
  { id: "trauma", name: "Trauma" },
];

interface Question {
  id: string;
  questionText: string;
  questionType: 'multiple-choice';
  options: { id: string; text: string }[];
  correctAnswerId: string;
  explanation: string;
}

interface UserAnswer {
  questionId: string;
  selectedAnswerId?: string;
  isCorrect: boolean;
}

export default function QuizPage() {
  const [quizState, setQuizState] = useState<'setup' | 'in-progress' | 'completed'>('setup');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedLength, setSelectedLength] = useState<number>(5);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [selectedOption, setSelectedOption] = useState<string | undefined>(undefined);
  const [showFeedback, setShowFeedback] = useState<boolean>(false);
  const [userAnswers, setUserAnswers] = useState<UserAnswer[]>([]);
  const [score, setScore] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const startQuiz = async () => {
    if (selectedCategories.length === 0) {
      setError("Please select at least one category.");
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      const res = await fetch('/api/quiz/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categories: selectedCategories, length: selectedLength }),
      });
      const data = await res.json();
      if (data.questions) {
        setQuestions(data.questions);
        setQuizState('in-progress');
      } else {
        setError('Failed to load questions');
      }
    } catch {
      setError('An error occurred generating the quiz.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnswerSubmit = () => {
    const currentQuestion = questions[currentQuestionIndex];
    if (!selectedOption) return;
    const isCorrect = selectedOption === currentQuestion.correctAnswerId;
    setUserAnswers(prev => [
      ...prev,
      { questionId: currentQuestion.id, selectedAnswerId: selectedOption, isCorrect }
    ]);
    if (isCorrect) setScore(prev => prev + 1);
    setShowFeedback(true);
  };

  const handleNextQuestion = () => {
    setShowFeedback(false);
    setSelectedOption(undefined);
    if (currentQuestionIndex + 1 < questions.length) {
      setCurrentQuestionIndex(idx => idx + 1);
    } else {
      setQuizState('completed');
    }
  };

  const resetQuiz = () => {
    setQuizState('setup');
    setQuestions([]);
    setCurrentQuestionIndex(0);
    setSelectedOption(undefined);
    setShowFeedback(false);
    setUserAnswers([]);
    setScore(0);
    setError(null);
  };

  // SETUP SCREEN
  if (quizState === 'setup') {
    return (
      <div className="p-6 max-w-xl mx-auto space-y-4 text-white">
        <h1 className="text-3xl font-bold">Setup Your Quiz</h1>
        {error && <p className="text-red-400">{error}</p>}
        {/* Add category & length selectors here */}
        <Button onClick={startQuiz} disabled={isLoading} className="w-full">
          {isLoading ? 'Loading...' : 'Start Quiz'}
        </Button>
      </div>
    );
  }

  // IN-PROGRESS SCREEN
  if (quizState === 'in-progress' && questions[currentQuestionIndex]) {
    const currentQuestion = questions[currentQuestionIndex];
    return (
      <div className="p-6 space-y-6 max-w-2xl mx-auto text-white">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">
            Question {currentQuestionIndex + 1} of {questions.length}
          </h2>
          <Progress value={((currentQuestionIndex + 1) / questions.length) * 100} className="w-1/2" />
        </div>
        <p className="text-lg font-medium">{currentQuestion.questionText}</p>
        <RadioGroup
          value={selectedOption}
          onValueChange={setSelectedOption}
          className="space-y-2"
        >
          {currentQuestion.options.map(option => (
            <Label
              key={option.id}
              htmlFor={option.id}
              className={`flex items-center p-3 border rounded-md cursor-pointer hover:bg-gray-50 transition-colors ${
                showFeedback && option.id === currentQuestion.correctAnswerId
                  ? 'border-green-500 bg-green-50 text-white'
                  : 'border-gray-300'
              }`}
            >
              <RadioGroupItem
                value={option.id}
                id={option.id}
                className="mr-3"
                disabled={showFeedback}
              />
              <span className={`${showFeedback && option.id === currentQuestion.correctAnswerId ? 'font-semibold' : ''}`}>{option.text}</span>
              {showFeedback && option.id === currentQuestion.correctAnswerId && (
                <CheckCircle className="ml-auto h-5 w-5 text-green-200" />
              )}
              {showFeedback && selectedOption === option.id && option.id !== currentQuestion.correctAnswerId && (
                <XCircle className="ml-auto h-5 w-5 text-red-200" />
              )}
            </Label>
          ))}
        </RadioGroup>
        {showFeedback && (
          <div className="p-4 mt-4 rounded-md bg-blue-600 border border-blue-400">
            <p className="text-sm font-semibold">Explanation:</p>
            <p className="text-sm whitespace-pre-line">{currentQuestion.explanation}</p>
          </div>
        )}
        {!showFeedback ? (
          <Button onClick={handleAnswerSubmit} disabled={!selectedOption} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
            Submit
          </Button>
        ) : (
          <Button onClick={handleNextQuestion} className="w-full bg-green-600 hover:bg-green-700 text-white">
            {currentQuestionIndex + 1 < questions.length ? 'Next Question' : 'Finish Quiz'}
          </Button>
        )}
      </div>
    );
  }

  // COMPLETION SCREEN
  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto text-white">
      <h1 className="text-3xl font-bold text-center">Quiz Completed!</h1>
      <div className="p-6 bg-gray-700 rounded-lg shadow text-center">
        <p className="text-xl">Your Score:</p>
        <p className="text-4xl font-bold">{score} / {questions.length}</p>
        <p className="text-2xl">({((score / questions.length) * 100).toFixed(0)}%)</p>
      </div>
      <h3 className="text-xl font-semibold mt-6 mb-3">Review Your Answers:</h3>
      <div className="space-y-4">
        {questions.map(q => {
          const ua = userAnswers.find(ua => ua.questionId === q.id);
          const selectedOptText = q.options.find(opt => opt.id === ua?.selectedAnswerId)?.text;
          const correctOptText = q.options.find(opt => opt.id === q.correctAnswerId)?.text;
          return (
            <div key={q.id} className="p-4 border rounded-md bg-gray-800 shadow-sm">
              <p className="text-md font-semibold">{q.questionText}</p>
              <p className={`text-sm ${ua?.isCorrect ? 'text-green-200' : 'text-red-200'}`}>
                Your answer: {selectedOptText || 'No answer'} {ua?.isCorrect ? '(Correct)' : '(Incorrect)'}
              </p>
              {!ua?.isCorrect && (
                <p className="text-sm text-gray-300">Correct answer: {correctOptText}</p>
              )}
              <p className="text-xs italic mt-1">Explanation: {q.explanation}</p>
            </div>
          );
        })}
      </div>
      <Button onClick={resetQuiz} className="w-full bg-blue-600 hover:bg-blue-700 text-white text-lg py-3 mt-6">
        Take Another Quiz
      </Button>
    </div>
  );
}
