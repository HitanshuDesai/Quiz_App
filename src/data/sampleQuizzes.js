// Sample quizzes importable from the host dashboard. They demonstrate every
// MVP round type so a new host can explore the platform immediately.

const q = (id, props) => ({
  id,
  options: [],
  points: 10,
  timeLimit: 30,
  mediaUrl: '',
  mediaType: 'image',
  ...props,
});

export const SAMPLE_QUIZZES = [
  {
    title: 'Sample: World Trivia Night',
    description: 'A classic pub-quiz format: general knowledge, speed, estimation and a wager finale.',
    archived: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    rounds: [
      {
        id: 'r1', name: 'Around the World', category: 'Geography',
        description: 'Standard round — everyone answers, no rush.',
        type: 'standard', settings: {},
        questions: [
          q('q1', {
            text: 'Which country has the most time zones (including overseas territories)?',
            type: 'multiple_choice',
            options: ['Russia', 'France', 'USA', 'China'],
            correctAnswer: 1, points: 10, timeLimit: 30,
          }),
          q('q2', {
            text: 'The Great Barrier Reef is visible from space.',
            type: 'true_false', correctAnswer: 'true', points: 5, timeLimit: 20,
          }),
          q('q3', {
            text: 'What is the capital city of Canada?',
            type: 'free_text', correctAnswer: 'Ottawa', points: 10, timeLimit: 25,
          }),
        ],
      },
      {
        id: 'r2', name: 'Quick Thinking', category: 'General Knowledge',
        description: 'Fastest finger first — correct answers earn speed bonuses!',
        type: 'fastest_finger',
        settings: { speedBonusMax: 5, firstCorrectBonus: 5 },
        questions: [
          q('q4', {
            text: 'Which planet is known as the Red Planet?',
            type: 'multiple_choice',
            options: ['Venus', 'Jupiter', 'Mars', 'Mercury'],
            correctAnswer: 2, points: 10, timeLimit: 15,
          }),
          q('q5', {
            text: 'How many sides does a hexagon have?',
            type: 'multiple_choice',
            options: ['5', '6', '7', '8'],
            correctAnswer: 1, points: 10, timeLimit: 10,
          }),
        ],
      },
      {
        id: 'r3', name: 'Price is Right-ish', category: 'Estimation',
        description: 'Closest answer wins the points — no need to be exact.',
        type: 'closest_wins', settings: {},
        questions: [
          q('q6', {
            text: 'How tall is Mount Everest, in metres?',
            type: 'closest_number', correctAnswer: 8849, points: 15, timeLimit: 30,
          }),
          q('q7', {
            text: 'In what year was the first iPhone released?',
            type: 'closest_number', correctAnswer: 2007, points: 15, timeLimit: 20,
          }),
        ],
      },
      {
        id: 'r4', name: 'All or Nothing', category: 'Finale',
        description: 'Wager your points before you see the question!',
        type: 'wager', settings: { maxWager: 0 },
        questions: [
          q('q8', {
            text: 'Shakespeare wrote exactly 37 plays.',
            type: 'true_false', correctAnswer: 'true', points: 0, timeLimit: 30,
          }),
        ],
      },
    ],
  },
  {
    title: 'Sample: Game Show Special',
    description: 'Buzzer battles, open challenges, picture questions and directed questions with passing.',
    archived: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    rounds: [
      {
        id: 'r1', name: 'Buzz In!', category: 'Rapid Fire',
        description: 'Buzz first to win the right to answer out loud. Wrong answers re-open the buzzers.',
        type: 'buzzer',
        settings: { lockOnBuzz: true, allowPassing: true, wrongPenalty: 5, maxAttemptsPerPlayer: 1 },
        questions: [
          q('q1', {
            text: 'Name the largest ocean on Earth.',
            type: 'free_text', correctAnswer: 'Pacific|Pacific Ocean', points: 10, timeLimit: 0,
          }),
          q('q2', {
            text: 'Which artist painted the Mona Lisa?',
            type: 'free_text', correctAnswer: 'Leonardo da Vinci|da Vinci|Leonardo', points: 10, timeLimit: 0,
          }),
        ],
      },
      {
        id: 'r2', name: 'First Correct Wins', category: 'Open Challenge',
        description: 'Everyone can answer — the first correct answer takes it all and closes the question.',
        type: 'open_challenge', settings: {},
        questions: [
          q('q3', {
            text: 'Type the chemical symbol for gold.',
            type: 'free_text', correctAnswer: 'Au', points: 15, timeLimit: 30,
          }),
          q('q4', {
            text: 'What is 17 × 6?',
            type: 'free_text', correctAnswer: '102', points: 15, timeLimit: 30,
          }),
        ],
      },
      {
        id: 'r3', name: 'Picture This', category: 'Pictures',
        description: 'Identify what you see in the image.',
        type: 'picture', settings: {},
        questions: [
          q('q5', {
            text: 'Which landmark is shown in this picture?',
            type: 'image',
            correctAnswer: 'Eiffel Tower|The Eiffel Tower',
            mediaUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/Tour_Eiffel_Wikimedia_Commons_%28cropped%29.jpg/480px-Tour_Eiffel_Wikimedia_Commons_%28cropped%29.jpg',
            mediaType: 'image', points: 10, timeLimit: 30,
          }),
          q('q6', {
            text: 'Name the animal in this photo.',
            type: 'image',
            correctAnswer: 'Red panda|Firefox',
            mediaUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0a/Red_Panda_%2824986761703%29.jpg/480px-Red_Panda_%2824986761703%29.jpg',
            mediaType: 'image', points: 10, timeLimit: 30,
          }),
        ],
      },
      {
        id: 'r4', name: 'On the Spot', category: 'Directed',
        description: 'The host picks who answers. Miss it and it can be passed on!',
        type: 'passing', settings: { maxPasses: 2 },
        questions: [
          q('q7', {
            text: 'Name three countries that start with the letter "B".',
            type: 'free_text', correctAnswer: 'host judges', points: 10, timeLimit: 45,
          }),
          q('q8', {
            text: 'What is the longest river in the world?',
            type: 'free_text', correctAnswer: 'Nile|The Nile|Amazon', points: 10, timeLimit: 30,
          }),
        ],
      },
    ],
  },
];
