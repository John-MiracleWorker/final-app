"use client";

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { CheckCircle, XCircle } from 'lucide-react';
import { Progress } from "@/components/ui/progress";

// Mocked protocol categories - replace with dynamic later
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

  const toggleCategory = (catId: string) => {
    setSelectedCategories(prev =>
      prev.includes(catId) ? prev.filter(id => id !== catId) : [...prev, catId]
    );
  };

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
        <div>
          <p className="text-sm font-medium">Select Categories:</p>
          <div className="mt-2 space-y-2">
            {MOCK_CATEGORIES.map(c => (
              <Label key={c.id} htmlFor={c.id} className="flex items-center">
                <input
                  type="checkbox"
                  id={c.id}
                  checked={selectedCategories.includes(c.id)}
                  onChange={() => toggleCategory(c.id)}
                  className="mr-2"
                />
                {c.name}
              </Label>
            ))}
          </div>
        </div>
        <div>
          <Label htmlFor="length" className="block text-sm font-medium">Number of questions:</Label>
          <input
            type="number"
            id="length"
            value={selectedLength}
            onChange={e => setSelectedLength(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
            min={1}
            max={20}
            className="mt-1 block w-full border border-gray-300 rounded-md p-2 text-black"
          />
        </div>
        <Button onClick={startQuiz} disabled={isLoading} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
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
          <Button onClick={handleAnswerSubmit} disabled={!selectedOption} className="w
