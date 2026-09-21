/**
 * automata.js - Formal Language Theory Engine for ε-NFA, NFA without ε, and DFA
 * Handles:
 * - ε-Closure computation with cycle detection
 * - Direct ε-elimination: conversion of ε-NFA to equivalent NFA without ε
 * - Subset construction algorithm: conversion of ε-NFA to DFA
 * - State naming preserving actual state subsets ([q0], [q0, q1], etc.) - NO A, B, C!
 * - String simulation with execution path tracking
 */

class EpsilonNFA {
    constructor() {
        this.states = [];          // Array of state names, e.g. ['q0', 'q1', 'q2']
        this.alphabet = [];        // Array of symbols, e.g. ['0', '1'] or ['a', 'b']
        this.startState = 'q0';    // Default start state
        this.finalStates = new Set(); // Set of accepting state names
        this.transitions = {};     // Map: state -> { symbol -> Set of destination states }
        this.epsilonSymbol = 'ε';  // Standard epsilon symbol
    }

    /**
     * Initializes or resets states from q0 up to q(n-1) or qn
     * @param {number} count - Total number of states
     */
    setStatesFromCount(count) {
        this.states = [];
        this.transitions = {};
        for (let i = 0; i < count; i++) {
            const stateName = `q${i}`;
            this.states.push(stateName);
            this.transitions[stateName] = {};
        }
        if (!this.states.includes(this.startState)) {
            this.startState = this.states[0] || 'q0';
        }
        // Filter final states that no longer exist
        this.finalStates = new Set([...this.finalStates].filter(s => this.states.includes(s)));
    }

    /**
     * Sets the alphabet symbols
     * @param {string[]} symbols
     */
    setAlphabet(symbols) {
        this.alphabet = symbols.filter(s => s.trim() !== '' && s !== this.epsilonSymbol && s !== 'eps');
    }

    /**
     * Adds a transition from fromState to toState on symbol
     */
    addTransition(fromState, symbol, toState) {
        if (!this.transitions[fromState]) {
            this.transitions[fromState] = {};
        }
        const sym = (symbol === 'eps' || symbol === 'epsilon' || symbol === 'λ') ? this.epsilonSymbol : symbol;
        if (!this.transitions[fromState][sym]) {
            this.transitions[fromState][sym] = new Set();
        }
        this.transitions[fromState][sym].add(toState);
    }

    /**
     * Removes a specific transition
     */
    removeTransition(fromState, symbol, toState) {
        const sym = (symbol === 'eps' || symbol === 'epsilon' || symbol === 'λ') ? this.epsilonSymbol : symbol;
        if (this.transitions[fromState] && this.transitions[fromState][sym]) {
            this.transitions[fromState][sym].delete(toState);
            if (this.transitions[fromState][sym].size === 0) {
                delete this.transitions[fromState][sym];
            }
        }
    }

    /**
     * Clear all transitions
     */
    clearTransitions() {
        for (const state of this.states) {
            this.transitions[state] = {};
        }
    }

    /**
     * Computes the ε-closure for a single state
     * ε-closure(q) = {q} U {p | there is an ε-path from q to p}
     * @param {string} state
     * @returns {Set<string>}
     */
    getEpsilonClosureSingle(state) {
        const closure = new Set([state]);
        const stack = [state];

        while (stack.length > 0) {
            const current = stack.pop();
            const epsTransitions = this.transitions[current]?.[this.epsilonSymbol];
            if (epsTransitions) {
                for (const nextState of epsTransitions) {
                    if (!closure.has(nextState)) {
                        closure.add(nextState);
                        stack.push(nextState);
                    }
                }
            }
        }
        return closure;
    }

    /**
     * Computes the ε-closure for a set of states
     * @param {Set<string>|string[]} stateSet
     * @returns {Set<string>}
     */
    getEpsilonClosure(stateSet) {
        const result = new Set();
        for (const state of stateSet) {
            const singleClosure = this.getEpsilonClosureSingle(state);
            for (const s of singleClosure) {
                result.add(s);
            }
        }
        return result;
    }

    /**
     * Helper to sort and key a state set consistently into subset string: [q0, q1]
     * Never changes states into arbitrary letters like A or B!
     */
    formatStateLabel(stateSet) {
        if (!stateSet || (stateSet instanceof Set && stateSet.size === 0) || (Array.isArray(stateSet) && stateSet.length === 0)) {
            return '[∅]';
        }
        const arr = Array.from(stateSet).sort((a, b) => {
            const numA = parseInt(a.replace(/\D/g, ''), 10);
            const numB = parseInt(b.replace(/\D/g, ''), 10);
            return (isNaN(numA) || isNaN(numB)) ? a.localeCompare(b) : numA - numB;
        });
        return `[${arr.join(', ')}]`;
    }

    /**
     * Formats set as mathematical set {q0, q1}
     */
    setToString(stateSet) {
        if (!stateSet || (stateSet instanceof Set && stateSet.size === 0) || (Array.isArray(stateSet) && stateSet.length === 0)) {
            return '∅';
        }
        const arr = Array.from(stateSet).sort((a, b) => {
            const numA = parseInt(a.replace(/\D/g, ''), 10);
            const numB = parseInt(b.replace(/\D/g, ''), 10);
            return (isNaN(numA) || isNaN(numB)) ? a.localeCompare(b) : numA - numB;
        });
        return `{${arr.join(', ')}}`;
    }

    /**
     * 1. CONVERSION TO NFA WITHOUT EPSILON (REMOVING EPSILON)
     * For each q ∈ Q and a ∈ Σ:
     *   δ'(q, a) = ε-closure(δ(ε-closure(q), a))
     * New final states F' = { q ∈ Q | ε-closure(q) ∩ F ≠ ∅ }
     */
    removeEpsilon() {
        const closureTable = {};
        for (const state of this.states) {
            closureTable[state] = Array.from(this.getEpsilonClosureSingle(state)).sort((a, b) => {
                const numA = parseInt(a.replace(/\D/g, ''), 10);
                const numB = parseInt(b.replace(/\D/g, ''), 10);
                return (isNaN(numA) || isNaN(numB)) ? a.localeCompare(b) : numA - numB;
            });
        }

        const newTransitions = {};
        const stepLogs = [];

        // For each state q
        for (const q of this.states) {
            newTransitions[q] = {};
            const qClosure = this.getEpsilonClosureSingle(q);

            for (const sym of this.alphabet) {
                // Step 1: Find all states reachable from any state in ε-closure(q) on symbol sym
                const moveSet = new Set();
                const movesPerState = [];

                for (const p of qClosure) {
                    const dests = this.transitions[p]?.[sym];
                    if (dests && dests.size > 0) {
                        for (const d of dests) moveSet.add(d);
                        movesPerState.push(`δ(${p}, ${sym}) = {${Array.from(dests).join(', ')}}`);
                    }
                }

                // Step 2: Compute ε-closure of the move set
                const targetClosure = this.getEpsilonClosure(moveSet);
                const sortedTarget = Array.from(targetClosure).sort((a, b) => {
                    const numA = parseInt(a.replace(/\D/g, ''), 10);
                    const numB = parseInt(b.replace(/\D/g, ''), 10);
                    return (isNaN(numA) || isNaN(numB)) ? a.localeCompare(b) : numA - numB;
                });

                newTransitions[q][sym] = sortedTarget;

                stepLogs.push({
                    state: q,
                    symbol: sym,
                    qClosure: Array.from(qClosure),
                    movesPerState: movesPerState,
                    moveSet: Array.from(moveSet),
                    targetClosure: sortedTarget,
                    explanation: `δ'(${q}, ${sym}) = ε-closure(δ(ε-closure(${q}), ${sym})) = ε-closure(${this.setToString(moveSet)}) = ${this.setToString(targetClosure)}`
                });
            }
        }

        // Compute new final states F'
        const newFinalStates = new Set();
        for (const q of this.states) {
            const qClosure = this.getEpsilonClosureSingle(q);
            const hasFinal = Array.from(qClosure).some(s => this.finalStates.has(s));
            if (hasFinal) {
                newFinalStates.add(q);
            }
        }

        return {
            states: [...this.states],
            alphabet: [...this.alphabet],
            startState: this.startState,
            finalStates: Array.from(newFinalStates),
            transitions: newTransitions,
            epsilonClosureTable: closureTable,
            stepLogs: stepLogs
        };
    }

    /**
     * 2. CONVERSION TO DFA (SUBSET CONSTRUCTION)
     * All states retain their exact subset designations: [q0], [q0, q1], etc.
     * Never changed to A, B, C!
     */
    convertToDFA(includeTrapState = false) {
        const stepLogs = [];
        const closureTable = {};

        // 1. Calculate ε-closure for all individual states
        for (const state of this.states) {
            const closure = this.getEpsilonClosureSingle(state);
            closureTable[state] = Array.from(closure).sort((a, b) => {
                const numA = parseInt(a.replace(/\D/g, ''), 10);
                const numB = parseInt(b.replace(/\D/g, ''), 10);
                return (isNaN(numA) || isNaN(numB)) ? a.localeCompare(b) : numA - numB;
            });
        }

        // 2. Initial DFA state: ε-closure(startState)
        const startClosure = this.getEpsilonClosure([this.startState]);
        const startLabel = this.formatStateLabel(startClosure);

        stepLogs.push({
            type: 'init',
            title: 'Initial DFA State Computation',
            description: `DFA Start State = ε-closure(${this.startState}) = ${startLabel}`
        });

        const dfaStates = [];
        const dfaTransitions = {};
        const visitedLabels = new Set();
        const queue = [];

        const isStartFinal = Array.from(startClosure).some(s => this.finalStates.has(s));
        const initialObj = {
            id: startLabel,
            label: startLabel,
            subset: startClosure,
            isStart: true,
            isFinal: isStartFinal
        };

        dfaStates.push(initialObj);
        visitedLabels.add(startLabel);
        queue.push(initialObj);

        // 3. Process the queue (Subset Construction)
        while (queue.length > 0) {
            const current = queue.shift();
            dfaTransitions[current.label] = {};

            stepLogs.push({
                type: 'process_state',
                title: `Processing DFA State ${current.label}`,
                stateLabel: current.label
            });

            for (const symbol of this.alphabet) {
                // Move: find all states reachable on symbol from any state in current.subset
                const moveSet = new Set();
                const individualMoves = [];

                for (const q of current.subset) {
                    const dests = this.transitions[q]?.[symbol];
                    if (dests && dests.size > 0) {
                        for (const d of dests) moveSet.add(d);
                        individualMoves.push(`δ(${q}, ${symbol}) = {${Array.from(dests).join(', ')}}`);
                    }
                }

                // Compute ε-closure of the move set
                const targetClosure = this.getEpsilonClosure(moveSet);
                const targetLabel = this.formatStateLabel(targetClosure);

                if (targetClosure.size === 0) {
                    // Empty / Trap transition
                    if (includeTrapState) {
                        const trapLabel = '[∅]';
                        if (!visitedLabels.has(trapLabel)) {
                            visitedLabels.add(trapLabel);
                            const trapObj = {
                                id: trapLabel,
                                label: trapLabel,
                                subset: new Set(),
                                isStart: false,
                                isFinal: false,
                                isTrap: true
                            };
                            dfaStates.push(trapObj);
                            queue.push(trapObj);
                        }
                        dfaTransitions[current.label][symbol] = trapLabel;
                    } else {
                        dfaTransitions[current.label][symbol] = null;
                    }

                    stepLogs.push({
                        type: 'transition',
                        fromLabel: current.label,
                        symbol: symbol,
                        moveSet: Array.from(moveSet),
                        resultKey: '∅',
                        targetLabel: includeTrapState ? '[∅]' : 'None (No Transition)',
                        isNew: false,
                        explanation: `δ_DFA(${current.label}, ${symbol}) = ε-closure(Move(${current.label}, ${symbol})) = ε-closure(∅) = ∅`
                    });
                } else {
                    let isNew = false;
                    if (!visitedLabels.has(targetLabel)) {
                        visitedLabels.add(targetLabel);
                        const isFinal = Array.from(targetClosure).some(s => this.finalStates.has(s));
                        const newStateObj = {
                            id: targetLabel,
                            label: targetLabel,
                            subset: targetClosure,
                            isStart: false,
                            isFinal: isFinal
                        };
                        dfaStates.push(newStateObj);
                        queue.push(newStateObj);
                        isNew = true;
                    }

                    dfaTransitions[current.label][symbol] = targetLabel;

                    stepLogs.push({
                        type: 'transition',
                        fromLabel: current.label,
                        symbol: symbol,
                        moveSet: Array.from(moveSet),
                        closure: Array.from(targetClosure),
                        targetLabel: targetLabel,
                        isNew: isNew,
                        individualMoves: individualMoves,
                        explanation: `δ_DFA(${current.label}, ${symbol}) = ε-closure(Move(${current.label}, ${symbol})) = ε-closure(${this.setToString(moveSet)}) = ${targetLabel}`
                    });
                }
            }
        }

        // If trap state was included, ensure trap state has self-loops on all symbols
        if (includeTrapState && visitedLabels.has('[∅]')) {
            if (!dfaTransitions['[∅]']) dfaTransitions['[∅]'] = {};
            for (const sym of this.alphabet) {
                dfaTransitions['[∅]'][sym] = '[∅]';
            }
        }

        // 4. Identify DFA accepting states
        const dfaFinalStates = dfaStates.filter(s => s.isFinal).map(s => s.label);

        return {
            alphabet: [...this.alphabet],
            epsilonClosureTable: closureTable,
            states: dfaStates,
            transitions: dfaTransitions,
            startState: startLabel,
            finalStates: dfaFinalStates,
            stepLogs: stepLogs
        };
    }

    /**
     * Simulates an input string on the DFA
     */
    static simulateDFA(dfa, inputString) {
        let currentState = dfa.startState;
        const trace = [{
            step: 0,
            char: 'Start',
            state: currentState,
            accepted: dfa.finalStates.includes(currentState)
        }];

        const chars = inputString.split('');
        for (let i = 0; i < chars.length; i++) {
            const ch = chars[i];
            const nextState = dfa.transitions[currentState]?.[ch];

            if (!nextState || nextState === '[∅]') {
                trace.push({
                    step: i + 1,
                    char: ch,
                    state: nextState || 'Trap / None',
                    isStuck: true,
                    accepted: false
                });
                return { accepted: false, trace: trace, stuckAt: i };
            }

            currentState = nextState;
            trace.push({
                step: i + 1,
                char: ch,
                state: currentState,
                accepted: dfa.finalStates.includes(currentState)
            });
        }

        const isAccepted = dfa.finalStates.includes(currentState);
        return { accepted: isAccepted, trace: trace };
    }
}

// Make accessible globally
window.EpsilonNFA = EpsilonNFA;
