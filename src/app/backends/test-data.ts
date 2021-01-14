import {Flashcard, FlashcardLearningData, NoteObject, ParentTagToChildTags} from '../types';
import {INITIAL_FLASHCARD_LEARNING_DATA} from '../constants';

export const TEST_NOTES: NoteObject[] = [
    {
        id: '1',
        title: 'Connected Notes overview',
        content:
`#connected-notes #zettelkasten

Connected Notes is a note taking app that supports the [[Zettelkasten method]] and flashcards as first class citizen.

# Zettelkasten support

Zettelkasten support comes in two forms: support for tagging and connecting notes.

## Tagging

Tagging notes can be done by placing a hashtag followed by the tag anywhere in the note, like is done on the first line of this document.

## Connecting notes

Connecting notes is done by placing the note you want to connect to inside square brackets, like when we referenced [[Zettelkasten method]] note above.

If you reference a note that doesn't exist, [[like this]], it will show up in red.

# Navigation

You can open notes by clicking on then in the left menu or by finding them using ctrl+shift+f. If you hold control (or cmd for mac users) at the same time, the note will be opened in a new view.

If you have refenced a note, you can hold ctrl/cmd and click on the reference to jump directly to the note. You can then navigate back using the 'back' button of the browser. 
`,
        lastChangedEpochMillis: 1
    },
    {
        id: '2',
        title: 'Zettelkasten method',
        content:
`#zettelkasten

# Overview

Zettelkasten is a knowledge management method based on tagging and connecting notes.

Tagging notes is designed to allow for arbitrary grouping of notes.
`,
        lastChangedEpochMillis: 1
    },
    {
        id: '3',
        title: 'TODO',
        content:
            `This is just an example of a note without any tags.`,
        lastChangedEpochMillis: 1
    },
    {
        id: '4',
        title: 'Texas Holdem overview',
        content:
`#texas-holdem

# Overview

Texas hold 'em (also known as Texas holdem, hold 'em, and holdem) is one of the most popular variants of the card game of poker. It's usually played in groups of 2-10 people.

# Rules

Two players (usually) must post money to the pot. These people are called the 'blinds' because they put money to the pot without seeing their cards. These 2 people rotate after every hand.

Everyone at the table is dealt 2 cards face down. Everyone can look at their cards, but won't see other players' cards. Then, the first betting round starts.

The first players to the left of the last person to put money to the pot must either fold their hand (meaning they're out of the game), call (meaning they must match whatever money someone else has put to the pot) or raise (put more money to the pot than the amount to call).


`,
        lastChangedEpochMillis: 1
    },
    {
        id: '5',
        title: 'Holdem preflop strategies',
        content:
            `#texas-holdem-strategies

In [[Texas Holdem overview]] the position you're in is very important. The later your turn is, the better. This is because you can see what other players do before you, giving you information.

# Early and middle positions

Early position players are those who are first to act. These positions are considered the worst positions, and in a full-table game (~10 players) players in early position should fold the majority of their hands. However, it's considered to be a sign of a strong hand when a player in early position raises.

Correspondingly, middle positions are somewhat better than early positions and they should fold slightly less hands than early positions, but the strategies are quite similar.

# Late position

Late positions usually refer to the button and cut-off. These players have the most information and playability and should play hands at a much higher rate than players in early or middle positions.
`,
        lastChangedEpochMillis: 1
    },
    {
        id: '6',
        title: 'Game theory optimal poker',
        content:
            `#texas-holdem-strategies #game-theory

[[Texas Holdem overview]] is a game where the optimal solution (in some sense) can be derived from game theory.

Heads-up holdem (ie. involving two players) has a unique [[Nash equilibrium]], unlike the variant with more than 2 players. While this might seem like a niche case, often poker hands are quickly reduced into hands with only 2 players, so studying these spots is sensible.

There's a lot of software out there that can approximate the [[Nash equilibrium]] of a situation, the most famous being piosolver.
`,
        lastChangedEpochMillis: 1
    },
    {
        id: '7',
        title: 'Nash equilibrium',
        content:
            `#game-theory

Nash equilibrium refers to a solution of a non-cooperative game involving two or more players. In a Nash equilibrium, each player is assumed to know the equilibrium strategies of the other players and no player has anything to gain by changing only his own strategy.
`,
        lastChangedEpochMillis: 1
    },
    {
        id: '8',
        title: 'Exploitative poker',
        content:
            `#texas-holdem-strategies

Exploitative poker refers to a style of poker where the focus is on trying to adjust to the playing style of the opponent to achieve maximum win rate.
`,
        lastChangedEpochMillis: 1
    },
];


export const TEST_NESTED_TAGS: ParentTagToChildTags = {
    '#texas-holdem': ['#texas-holdem-strategies']
};

export const TEST_FLASHCARDS: Flashcard[] = [
    {
        id: '1',
        createdEpochMillis: 0,
        lastChangedEpochMillis: 0,
        tags: ['#zettelkasten', '#some-another-tag'],
        side1: 'The two basic components of Zettelkasten are ...',
        side2: 'The two basic components of Zettelkasten are tagging and connecting notes',
        isTwoWay: false,
        learningData: INITIAL_FLASHCARD_LEARNING_DATA,
    },
    {
        id: '2',
        createdEpochMillis: 0,
        lastChangedEpochMillis: 0,
        tags: ['#sample-tag', '#another-sample-tag'],
        side1: 'Some people claim poker strategies can be roughly divided into two strategies, what are these?',
        side2: 'Game theory optimal and exploitative',
        isTwoWay: false,
        learningData: INITIAL_FLASHCARD_LEARNING_DATA,
    },
];

// Holdem preflop strategies
