"use client";

import React, { useState, useEffect, useCallback } from 'react';
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

const QUIZ_LENGTHS = [10, 25, 50];

interface QuizQuestion {
  id: string;
  questionText: string;
  questionType: 'multiple-choice' | 'scenario';
  scenarioText?: string; // Only for scenario type
  options?: { id: string; text: string }[]; // Only for multiple-choice
  correctAnswerId?: string; // Only for multiple-choice
  correctAnswerText?: string; // For scenario, if AI provides a model answer
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
  const [selectedLength, setSelectedLength] = useState<number>(QUIZ_LENGTHS[0]);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [userAnswers, setUserAnswers] = useState<UserAnswer[]>([]);
  const [selectedOption, setSelectedOption] = useState<string | undefined>(undefined);
  const [showFeedback, setShowFeedback] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleCategoryChange = (categoryId: string) => {
    setSelectedCategories(prev => 
      prev.includes(categoryId) 
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const startQuiz = async () => {
    if (selectedCategories.length === 0) {
      setError("Please select at least one category.");
      return;
    }
    setError(null);
    setIsLoading(true);
    setShowFeedback(false);
    setSelectedOption(undefined);
    // TODO: API call to /api/quiz/generate
    // For now, using mock questions
    console.log(`Starting quiz with categories: ${selectedCategories.join(', ')} and length: ${selectedLength}`);
    try {
      const response = await fetch('/api/quiz/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ categories: selectedCategories, length: selectedLength }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate quiz questions.');
      }
      const data = await response.json();
      setQuestions(data.questions);
      setCurrentQuestionIndex(0);
      setUserAnswers([]);
      setQuizState('in-progress');
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred while fetching questions.');
      setQuestions([]); // Clear any old questions
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnswerSubmit = () => {
    if (!selectedOption || !questions[currentQuestionIndex]) return;

    const currentQuestion = questions[currentQuestionIndex];
    let isCorrect = false;
    if (currentQuestion.questionType === 'multiple-choice') {
      isCorrect = selectedOption === currentQuestion.correctAnswerId;
    }
    // For scenario, correctness might be more complex or AI-driven if not MCQ
    // For now, assuming scenario questions are also presented as MCQ for simplicity in this stub

    setUserAnswers(prev => [...prev, { 
      questionId: currentQuestion.id, 
      selectedAnswerId: selectedOption, 
      isCorrect 
    }]);
    setShowFeedback(true);
  };

  const handleNextQuestion = () => {
    setSelectedOption(undefined);
    setShowFeedback(false);
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      setQuizState('completed');
    }
  };

  const resetQuiz = () => {
    setQuizState('setup');
    setSelectedCategories([]);
    // setSelectedLength(QUIZ_LENGTHS[0]); // Keep selected length or reset?
    setQuestions([]);
    setCurrentQuestionIndex(0);
    setUserAnswers([]);
    setSelectedOption(undefined);
    setShowFeedback(false);
    setError(null);
  };
  
  const currentQuestion = questions[currentQuestionIndex];
  const score = userAnswers.filter(ans => ans.isCorrect).length;

  if (isLoading) {
    return <div className="p-6 text-center">Loading quiz questions...</div>;
  }

  if (quizState === 'setup') {
    return (
      <div className="p-6 space-y-6 max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800">Quiz Setup</h1>
        {error && (
          <div className="p-3 bg-red-100 border border-red-300 text-red-700 rounded-md flex items-center text-sm">
            <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
        <div>
          <Label className="text-lg font-semibold text-gray-700 mb-2 block">Select Categories:</Label>
          <div className="grid grid-cols-2 gap-4">
            {MOCK_CATEGORIES.map(category => (
              <Button 
                key={category.id} 
                variant={selectedCategories.includes(category.id) ? "default" : "outline"}
                onClick={() => handleCategoryChange(category.id)}
                className={`w-full ${selectedCategories.includes(category.id) ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
              >
                {category.name}
              </Button>
            ))}
          </div>
        </div>
        <div>
          <Label htmlFor="quizLength" className="text-lg font-semibold text-gray-700 mb-2 block">Select Quiz Length:</Label>
          <Select value={selectedLength.toString()} onValueChange={(val) => setSelectedLength(parseInt(val))}>
            <SelectTrigger id="quizLength" className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {QUIZ_LENGTHS.map(length => (
                <SelectItem key={length} value={length.toString()}>{length} Questions</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={startQuiz} disabled={isLoading || selectedCategories.length === 0} className="w-full bg-green-600 hover:bg-green-700 text-white text-lg py-3">
          {isLoading ? "Generating Quiz..." : "Start Quiz"}
        </Button>
      </div>
    );
  }

  if (quizState === 'in-progress' && currentQuestion) {
    return (
      <div className="p-6 space-y-6 max-w-2xl mx-auto">
        <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-800">Question {currentQuestionIndex + 1} of {questions.length}</h2>
            <Progress value={((currentQuestionIndex + 1) / questions.length) * 100} className="w-1/2" />
        </div>
        {currentQuestion.scenarioText && (
            <div className="p-4 bg-gray-100 rounded-md mb-4">
                <p className="text-md text-gray-700 font-semibold">Scenario:</p>
                <p className="text-gray-600 whitespace-pre-line">{currentQuestion.scenarioText}</p>
            </div>
        )}
        <p className="text-lg text-gray-700 font-medium">{currentQuestion.questionText}</p>
        
        {currentQuestion.questionType === 'multiple-choice' && currentQuestion.options && (
          <RadioGroup value={selectedOption} onValueChange={setSelectedOption} className="space-y-2">
            {currentQuestion.options.map(option => (
              <Label 
                key={option.id} 
                htmlFor={option.id} 
                className={`flex items-center p-3 border rounded-md cursor-pointer hover:bg-gray-50 transition-colors 
                            ${showFeedback && option.id === currentQuestion.correctAnswerId ? 'border-green-500 bg-green-50' : ''} 
                            ${showFeedback && selectedOption === option.id && option.id !== currentQuestion.correctAnswerId ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
              >
                <RadioGroupItem value={option.id} id={option.id} className="mr-3" disabled={showFeedback}/>
                <span className={`${showFeedback && option.id === currentQuestion.correctAnswerId ? 'text-green-700 font-semibold' : ''} 
                                 ${showFeedback && selectedOption === option.id && option.id !== currentQuestion.correctAnswerId ? 'text-red-700 font-semibold' : 'text-gray-800'}`}>
                  {option.text}
                </span>
                {showFeedback && option.id === currentQuestion.correctAnswerId && <CheckCircle className="ml-auto h-5 w-5 text-green-600"/>}
                {showFeedback && selectedOption === option.id && option.id !== currentQuestion.correctAnswerId && <XCircle className="ml-auto h-5 w-5 text-red-600"/>}
              </Label>
            ))}
          </RadioGroup>
        )}

        {showFeedback && (
          <div className="p-4 mt-4 rounded-md bg-blue-50 border border-blue-300">
            <p className="text-sm font-semibold text-blue-700">Explanation:</p>
            <p className="text-sm text-blue-600 whitespace-pre-line">{currentQuestion.explanation}</p>
          </div>
        )}

        {!showFeedback && (
          <Button onClick={handleAnswerSubmit} disabled={!selectedOption} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
            Submit Answer
          </Button>
        )}
        {showFeedback && (
          <Button onClick={handleNextQuestion} className="w-full bg-green-600 hover:bg-green-700 text-white">
            {currentQuestionIndex < questions.length - 1 ? "Next Question" : "View Results"}
          </Button>
        )}
      </div>
    );
  }

  if (quizState === 'completed') {
    return (
      <div className="p-6 space-y-6 max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-center text-gray-800">Quiz Completed!</h1>
        <div className="p-6 bg-gray-100 rounded-lg shadow text-center">
            <p className="text-xl text-gray-700">Your Score:</p>
            <p className="text-4xl font-bold text-blue-600">{score} / {questions.length}</p>
            <p className="text-2xl text-gray-600">({((score / questions.length) * 100).toFixed(0)}%)</p>
        </div>
        
        <h3 className="text-xl font-semibold text-gray-700 mt-6 mb-3">Review Your Answers:</h3>
        <div className="space-y-4">
            {questions.map((q, index) => {
                const userAnswer = userAnswers.find(ua => ua.questionId === q.id);
                const selectedOptText = q.options?.find(opt => opt.id === userAnswer?.selectedAnswerId)?.text;
                const correctOptText = q.options?.find(opt => opt.id === q.correctAnswerId)?.text;
                return (
                    <div key={q.id} className="p-4 border rounded-md bg-white shadow-sm">
                        <p className="text-md font-semibold text-gray-800">Q{index + 1}: {q.scenarioText ? `${q.scenarioText}\n${q.questionText}` : q.questionText}</p>
                        <p className={`text-sm ${userAnswer?.isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                            Your answer: {selectedOptText || "Not answered"} {userAnswer?.isCorrect ? "(Correct)" : "(Incorrect)"}
                        </p>
                        {!userAnswer?.isCorrect && <p className="text-sm text-gray-600">Correct answer: {correctOptText}</p>}
                        <p className="text-xs text-gray-500 mt-1 italic">Explanation: {q.explanation}</p>
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

  return <div className="p-6">Something went wrong. Please try setting up a new quiz.</div>;
}

