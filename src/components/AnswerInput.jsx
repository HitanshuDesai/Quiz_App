import React, { useState } from 'react';

// Player-side answer input, one renderer per question type.
// To support a new question type, add a case here and in lib/scoring.js.
export default function AnswerInput({ question, onSubmit, disabled }) {
  const [text, setText] = useState('');

  if (question.type === 'verbal') {
    return (
      <div className="card center-text">
        <h3>🎤 Answer out loud!</h3>
        <p className="muted">The host is listening and will mark your answer.</p>
      </div>
    );
  }

  if (question.type === 'multiple_choice') {
    return (
      <div className="answer-grid">
        {(question.options || []).map((opt, i) => (
          <button
            key={i}
            className={`btn option option-${i}`}
            disabled={disabled}
            onClick={() => onSubmit(i)}
          >
            <span className="option-letter">{String.fromCharCode(65 + i)}</span> {opt}
          </button>
        ))}
      </div>
    );
  }

  if (question.type === 'true_false') {
    return (
      <div className="answer-grid two">
        <button className="btn option option-true" disabled={disabled} onClick={() => onSubmit('true')}>
          ✔ True
        </button>
        <button className="btn option option-false" disabled={disabled} onClick={() => onSubmit('false')}>
          ✘ False
        </button>
      </div>
    );
  }

  const isNumber = question.type === 'closest_number';
  return (
    <form
      className="answer-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (text.trim() === '') return;
        onSubmit(isNumber ? Number(text) : text.trim());
      }}
    >
      <input
        type={isNumber ? 'number' : 'text'}
        inputMode={isNumber ? 'decimal' : 'text'}
        step="any"
        placeholder={isNumber ? 'Your number…' : 'Your answer…'}
        value={text}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        autoFocus
      />
      <button className="btn primary" type="submit" disabled={disabled || text.trim() === ''}>
        Submit
      </button>
    </form>
  );
}
