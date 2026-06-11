import React from 'react';

export default function QuestionMedia({ question }) {
  if (!question?.mediaUrl) return null;
  if (question.mediaType === 'audio') {
    return <audio className="question-media" controls src={question.mediaUrl} />;
  }
  return <img className="question-media" src={question.mediaUrl} alt="Question media" />;
}
