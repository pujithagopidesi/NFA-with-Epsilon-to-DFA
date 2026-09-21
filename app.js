/**
 * app.js - Application Controller for ε-NFA to DFA Web App
 * Orchestrates:
 * - Dynamic state generation (q0 to qn) and automatic circle rendering
 * - Epsilon removal: Transition Table & Graph of NFA without ε
 * - Subset construction: Transition Table & Graph of DFA with exact state names ([q0], [q0, q1] - NO A, B, C!)
 * - Dynamic SVG visualizers with exact arrowhead placement
 * - Interactive String Acceptance Simulator
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Core Model Instances
    const nfa = new EpsilonNFA();
    let currentNoEpsResult = null;
    let currentDfaResult = null;
    let simulationTrace = null;
    let currentSimStep = 0;
    let simInterval = null;

    // 2. Initialize Visualizers
    const nfaVisualizer = new AutomataVisualizer('nfaCanvas', {
        theme: 'dark',
        onNodeClick: (nodeId) => toggleFinalState(nodeId)
    });

    const noEpsVisualizer = new AutomataVisualizer('noEpsCanvas', {
        theme: 'dark'
    });

    const dfaVisualizer = new AutomataVisualizer('dfaCanvas', {
        theme: 'dark'
    });

    // 3. UI Element References
    const numStatesInput = document.getElementById('numStatesInput');
    const applyStatesBtn = document.getElementById('applyStatesBtn');
    const alphabetInput = document.getElementById('alphabetInput');
    const initialStateSelect = document.getElementById('initialStateSelect');
    const finalStatesChips = document.getElementById('finalStatesChips');
    const statesSummaryText = document.getElementById('statesSummaryText');
    const transFromSelect = document.getElementById('transFromSelect');
    const transSymbolSelect = document.getElementById('transSymbolSelect');
    const transToSelect = document.getElementById('transToSelect');
    const addTransitionBtn = document.getElementById('addTransitionBtn');
    const clearTransitionsBtn = document.getElementById('clearTransitionsBtn');
    const transitionMatrixTable = document.getElementById('transitionMatrixTable');
    const convertToDfaBtn = document.getElementById('convertToDfaBtn');
    const includeTrapStateCheck = document.getElementById('includeTrapStateCheck');
    const presetSelect = document.getElementById('presetSelect');
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    const exportJsonBtn = document.getElementById('exportJsonBtn');

    // Visualizer View Cards & Tabs
    const visualizerWrapper = document.getElementById('visualizerWrapper');
    const cardNfa = document.getElementById('cardNfa');
    const cardNoEps = document.getElementById('cardNoEps');
    const cardDfa = document.getElementById('cardDfa');
    const viewSplitBtn = document.getElementById('viewSplitBtn');
    const viewNfaBtn = document.getElementById('viewNfaBtn');
    const viewNoEpsBtn = document.getElementById('viewNoEpsBtn');
    const viewDfaBtn = document.getElementById('viewDfaBtn');
    const viewButtons = [viewSplitBtn, viewNfaBtn, viewNoEpsBtn, viewDfaBtn];

    // Accordions & Results
    const epsilonClosureTableContainer = document.getElementById('epsilonClosureTableContainer');
    const noEpsTransitionTableContainer = document.getElementById('noEpsTransitionTableContainer');
    const dfaTransitionTableContainer = document.getElementById('dfaTransitionTableContainer');
    const stepByStepContainer = document.getElementById('stepByStepContainer');

    // Simulator Elements
    const simInputString = document.getElementById('simInputString');
    const simPlayBtn = document.getElementById('simPlayBtn');
    const simStepNextBtn = document.getElementById('simStepNextBtn');
    const simResetBtn = document.getElementById('simResetBtn');
    const simTape = document.getElementById('simTape');
    const simCurrentState = document.getElementById('simCurrentState');
    const simResultBadge = document.getElementById('simResultBadge');

    // 4. View Switcher Handler
    function setDiagramView(viewMode) {
        viewButtons.forEach(btn => btn.classList.remove('active'));

        if (viewMode === 'split') {
            viewSplitBtn.classList.add('active');
            cardNfa.style.display = 'flex';
            cardNoEps.style.display = 'none';
            cardDfa.style.display = 'flex';
            visualizerWrapper.style.gridTemplateColumns = '1fr 1fr';
            setTimeout(() => {
                nfaVisualizer.fitToView();
                dfaVisualizer.fitToView();
            }, 50);
        } else if (viewMode === 'nfa') {
            viewNfaBtn.classList.add('active');
            cardNfa.style.display = 'flex';
            cardNoEps.style.display = 'none';
            cardDfa.style.display = 'none';
            visualizerWrapper.style.gridTemplateColumns = '1fr';
            setTimeout(() => nfaVisualizer.fitToView(), 50);
        } else if (viewMode === 'no-eps') {
            viewNoEpsBtn.classList.add('active');
            cardNfa.style.display = 'none';
            cardNoEps.style.display = 'flex';
            cardDfa.style.display = 'none';
            visualizerWrapper.style.gridTemplateColumns = '1fr';
            setTimeout(() => noEpsVisualizer.fitToView(), 50);
        } else if (viewMode === 'dfa') {
            viewDfaBtn.classList.add('active');
            cardNfa.style.display = 'none';
            cardNoEps.style.display = 'none';
            cardDfa.style.display = 'flex';
            visualizerWrapper.style.gridTemplateColumns = '1fr';
            setTimeout(() => dfaVisualizer.fitToView(), 50);
        }
    }

    viewSplitBtn.addEventListener('click', () => setDiagramView('split'));
    viewNfaBtn.addEventListener('click', () => setDiagramView('nfa'));
    viewNoEpsBtn.addEventListener('click', () => setDiagramView('no-eps'));
    viewDfaBtn.addEventListener('click', () => setDiagramView('dfa'));

    // 5. Update States from Number Input
    function updateStates(count) {
        const n = Math.max(1, Math.min(15, parseInt(count, 10) || 3));
        numStatesInput.value = n;

        nfa.setStatesFromCount(n);
        updateAlphabetFromInput();

        if (statesSummaryText) {
            statesSummaryText.innerHTML = `Automatically generated states: <strong>${nfa.states.join(', ')}</strong>`;
        }

        refreshStateSelectors();
        refreshFinalStateChips();
        refreshTransitionSelectors();
        renderTransitionMatrix();

        // Automatically render curved circles on the canvas!
        updateNfaVisualization();
    }

    function updateAlphabetFromInput() {
        const raw = alphabetInput.value;
        const symbols = raw.split(/[,;\s]+/).map(s => s.trim()).filter(s => s !== '' && s !== 'ε' && s !== 'eps');
        const uniqueSymbols = Array.from(new Set(symbols));
        nfa.setAlphabet(uniqueSymbols);
        refreshTransitionSelectors();
    }

    function refreshStateSelectors() {
        const prevInitial = nfa.startState;
        initialStateSelect.innerHTML = '';
        nfa.states.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s;
            opt.textContent = s;
            if (s === prevInitial) opt.selected = true;
            initialStateSelect.appendChild(opt);
        });

        if (!nfa.states.includes(nfa.startState) && nfa.states.length > 0) {
            nfa.startState = nfa.states[0];
            initialStateSelect.value = nfa.startState;
        }
    }

    function refreshFinalStateChips() {
        finalStatesChips.innerHTML = '';
        nfa.states.forEach(s => {
            const chip = document.createElement('div');
            chip.className = `state-chip ${nfa.finalStates.has(s) ? 'active' : ''}`;
            chip.textContent = s;
            chip.title = `Click to toggle ${s} as final / accepting state`;
            chip.addEventListener('click', () => toggleFinalState(s));
            finalStatesChips.appendChild(chip);
        });
    }

    function toggleFinalState(stateName) {
        if (nfa.finalStates.has(stateName)) {
            nfa.finalStates.delete(stateName);
        } else {
            nfa.finalStates.add(stateName);
        }
        refreshFinalStateChips();
        updateNfaVisualization();
    }

    function refreshTransitionSelectors() {
        transFromSelect.innerHTML = '';
        nfa.states.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s;
            opt.textContent = s;
            transFromSelect.appendChild(opt);
        });

        transToSelect.innerHTML = '';
        nfa.states.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s;
            opt.textContent = s;
            transToSelect.appendChild(opt);
        });

        transSymbolSelect.innerHTML = '';
        nfa.alphabet.forEach(sym => {
            const opt = document.createElement('option');
            opt.value = sym;
            opt.textContent = sym;
            transSymbolSelect.appendChild(opt);
        });
        const epsOpt = document.createElement('option');
        epsOpt.value = 'ε';
        epsOpt.textContent = 'ε (epsilon)';
        transSymbolSelect.appendChild(epsOpt);
    }

    function renderTransitionMatrix() {
        const symbols = [...nfa.alphabet, 'ε'];
        let html = '<thead><tr><th>State</th>';
        symbols.forEach(sym => {
            html += `<th>${sym}</th>`;
        });
        html += '</tr></thead><tbody>';

        nfa.states.forEach(state => {
            const isStart = state === nfa.startState ? '→ ' : '';
            const isFinal = nfa.finalStates.has(state) ? ' *' : '';
            html += `<tr><td>${isStart}${state}${isFinal}</td>`;

            symbols.forEach(sym => {
                const dests = nfa.transitions[state]?.[sym] ? Array.from(nfa.transitions[state][sym]).join(', ') : '';
                html += `<td>
                    <input type="text" data-from="${state}" data-symbol="${sym}" value="${dests}" placeholder="-" class="matrix-cell-input">
                </td>`;
            });
            html += '</tr>';
        });

        html += '</tbody>';
        transitionMatrixTable.innerHTML = html;

        transitionMatrixTable.querySelectorAll('.matrix-cell-input').forEach(input => {
            input.addEventListener('change', (e) => {
                const from = e.target.dataset.from;
                const sym = e.target.dataset.symbol;
                const val = e.target.value.trim();

                if (nfa.transitions[from] && nfa.transitions[from][sym]) {
                    delete nfa.transitions[from][sym];
                }

                if (val !== '' && val !== '-') {
                    const targets = val.split(/[,;\s]+/).map(t => t.trim()).filter(t => t !== '');
                    targets.forEach(to => {
                        if (nfa.states.includes(to)) {
                            nfa.addTransition(from, sym, to);
                        }
                    });
                }
                updateNfaVisualization();
            });
        });
    }

    function updateNfaVisualization() {
        nfaVisualizer.setData(nfa.states, nfa.transitions, nfa.startState, nfa.finalStates);
    }

    addTransitionBtn.addEventListener('click', () => {
        const from = transFromSelect.value;
        const sym = transSymbolSelect.value;
        const to = transToSelect.value;

        if (from && sym && to) {
            nfa.addTransition(from, sym, to);
            renderTransitionMatrix();
            updateNfaVisualization();
        }
    });

    clearTransitionsBtn.addEventListener('click', () => {
        if (confirm('Clear all transitions?')) {
            nfa.clearTransitions();
            renderTransitionMatrix();
            updateNfaVisualization();
        }
    });

    initialStateSelect.addEventListener('change', (e) => {
        nfa.startState = e.target.value;
        renderTransitionMatrix();
        updateNfaVisualization();
    });

    let statesInputDebounce = null;
    numStatesInput.addEventListener('input', () => {
        clearTimeout(statesInputDebounce);
        statesInputDebounce = setTimeout(() => {
            const val = parseInt(numStatesInput.value, 10);
            if (!isNaN(val) && val >= 1 && val <= 15) {
                updateStates(val);
            }
        }, 150);
    });

    applyStatesBtn.addEventListener('click', () => {
        updateStates(numStatesInput.value);
    });

    alphabetInput.addEventListener('input', () => {
        updateAlphabetFromInput();
        renderTransitionMatrix();
        updateNfaVisualization();
    });

    // 6. MAIN CONVERSION HANDLER (Remove ε and Convert to DFA)
    function runConversion() {
        updateAlphabetFromInput();
        const includeTrap = includeTrapStateCheck.checked;

        // 1. Remove Epsilon: Get NFA without ε
        const noEpsResult = nfa.removeEpsilon();
        currentNoEpsResult = noEpsResult;

        // 2. Subset Construction: Get DFA
        const dfaResult = nfa.convertToDFA(includeTrap);
        currentDfaResult = dfaResult;

        // Render Tables
        renderEpsilonClosureTable(dfaResult.epsilonClosureTable);
        renderNoEpsTransitionTable(noEpsResult);
        renderDfaTransitionTable(dfaResult);
        renderStepByStepLog(noEpsResult.stepLogs, dfaResult.stepLogs);

        // Render NFA without ε Graph
        const noEpsNodes = noEpsResult.states.map(s => ({
            id: s,
            label: s,
            isStart: s === noEpsResult.startState,
            isFinal: noEpsResult.finalStates.includes(s)
        }));
        const noEpsTransList = [];
        for (const from in noEpsResult.transitions) {
            for (const sym of noEpsResult.alphabet) {
                const dests = noEpsResult.transitions[from]?.[sym] || [];
                dests.forEach(to => {
                    noEpsTransList.push({ from, symbol: sym, to });
                });
            }
        }
        noEpsVisualizer.setData(noEpsNodes, noEpsTransList, noEpsResult.startState, new Set(noEpsResult.finalStates));

        // Render DFA Graph (Preserving exact state names [q0], [q0, q1] - NO A, B, C!)
        const dfaNodes = dfaResult.states.map(s => ({
            id: s.label,
            label: s.label,
            isStart: s.isStart,
            isFinal: s.isFinal
        }));

        const dfaTransList = [];
        for (const stateObj of dfaResult.states) {
            const row = dfaResult.transitions[stateObj.label];
            if (row) {
                for (const sym of dfaResult.alphabet) {
                    const targetLabel = row[sym];
                    if (targetLabel) {
                        dfaTransList.push({
                            from: stateObj.label,
                            symbol: sym,
                            to: targetLabel
                        });
                    }
                }
            }
        }

        const dfaFinalSet = new Set(dfaResult.finalStates);
        dfaVisualizer.setData(dfaNodes, dfaTransList, dfaResult.startState, dfaFinalSet);

        // Reset Simulator
        resetSimulator();
    }

    convertToDfaBtn.addEventListener('click', runConversion);
    includeTrapStateCheck.addEventListener('change', () => {
        if (currentDfaResult) runConversion();
    });

    // 7. Render ε-Closure Table
    function renderEpsilonClosureTable(closureTable) {
        let html = `
            <table class="matrix-table" style="max-width: 500px;">
                <thead>
                    <tr>
                        <th style="width: 140px;">State (q)</th>
                        <th>ε-Closure(q)</th>
                    </tr>
                </thead>
                <tbody>
        `;

        for (const state of nfa.states) {
            const closureArr = closureTable[state] || [state];
            html += `
                <tr>
                    <td><strong>${state}</strong></td>
                    <td style="color: var(--secondary); font-weight: 700; font-family: var(--font-mono);">{ ${closureArr.join(', ')} }</td>
                </tr>
            `;
        }

        html += `</tbody></table>`;
        epsilonClosureTableContainer.innerHTML = html;
    }

    // 8. Render Transition Table After Removing Epsilon (NFA without ε)
    function renderNoEpsTransitionTable(noEps) {
        let html = `
            <table class="matrix-table">
                <thead>
                    <tr>
                        <th>State (Q)</th>
        `;

        noEps.alphabet.forEach(sym => {
            html += `<th>Input '${sym}'</th>`;
        });
        html += `<th>Status</th></tr></thead><tbody>`;

        noEps.states.forEach(state => {
            const isStart = state === noEps.startState ? '→ ' : '';
            const isFinal = noEps.finalStates.includes(state) ? ' *' : '';
            const statusBadge = noEps.finalStates.includes(state)
                ? `<span class="badge-accepted" style="font-size: 0.72rem;">Accepting</span>`
                : `<span style="color: var(--text-muted); font-size: 0.72rem;">Non-Accepting</span>`;

            html += `
                <tr>
                    <td style="font-weight: 700; color: var(--accent); font-size: 0.95rem;">${isStart}${state}${isFinal}</td>
            `;

            noEps.alphabet.forEach(sym => {
                const dests = noEps.transitions[state]?.[sym];
                if (dests && dests.length > 0) {
                    html += `<td><strong style="color: var(--secondary);">{ ${dests.join(', ')} }</strong></td>`;
                } else {
                    html += `<td style="color: var(--text-muted);">∅</td>`;
                }
            });

            html += `<td>${statusBadge}</td></tr>`;
        });

        html += `</tbody></table>`;
        noEpsTransitionTableContainer.innerHTML = html;
    }

    // 9. Render DFA Transition Table (States: [q0], [q0, q1] - NEVER A, B, C!)
    function renderDfaTransitionTable(dfa) {
        let html = `
            <table class="matrix-table">
                <thead>
                    <tr>
                        <th>DFA State</th>
        `;

        dfa.alphabet.forEach(sym => {
            html += `<th>Input '${sym}'</th>`;
        });
        html += `<th>Status</th></tr></thead><tbody>`;

        dfa.states.forEach(state => {
            const isStart = state.isStart ? '→ ' : '';
            const isFinal = state.isFinal ? ' *' : '';
            const statusBadge = state.isFinal
                ? `<span class="badge-accepted" style="font-size: 0.72rem;">Accepting</span>`
                : `<span style="color: var(--text-muted); font-size: 0.72rem;">Non-Accepting</span>`;

            html += `
                <tr>
                    <td style="font-weight: 700; color: var(--primary-light); font-size: 0.95rem;">${isStart}${state.label}${isFinal}</td>
            `;

            dfa.alphabet.forEach(sym => {
                const targetLabel = dfa.transitions[state.label]?.[sym];
                if (targetLabel && targetLabel !== '[∅]') {
                    html += `<td><strong style="color: var(--secondary);">${targetLabel}</strong></td>`;
                } else if (targetLabel === '[∅]') {
                    html += `<td style="color: var(--danger); font-weight: 600;">[∅] (Trap)</td>`;
                } else {
                    html += `<td style="color: var(--text-muted);">-</td>`;
                }
            });

            html += `<td>${statusBadge}</td></tr>`;
        });

        html += `</tbody></table>`;
        dfaTransitionTableContainer.innerHTML = html;
    }

    // 10. Render Step-by-Step Construction Log
    function renderStepByStepLog(noEpsLogs, dfaLogs) {
        let html = '<h4 style="color: var(--text-primary); margin-bottom: 10px;">Part A: ε-Elimination Steps:</h4>';
        noEpsLogs.forEach(log => {
            html += `
                <div class="step-log-card" style="margin-left: 10px; margin-bottom: 8px;">
                    <div class="step-log-header">
                        <span>δ'(${log.state}, ${log.symbol})</span>
                    </div>
                    <div class="step-log-code">${log.explanation}</div>
                </div>
            `;
        });

        html += '<h4 style="color: var(--text-primary); margin-top: 16px; margin-bottom: 10px;">Part B: DFA Subset Construction Steps:</h4>';
        dfaLogs.forEach(log => {
            if (log.type === 'init') {
                html += `
                    <div class="step-log-card step-new">
                        <div class="step-log-header">
                            <span style="color: var(--success);">✔</span> ${log.title}
                        </div>
                        <div>${log.description}</div>
                    </div>
                `;
            } else if (log.type === 'process_state') {
                html += `
                    <div class="step-log-card" style="border-left-color: var(--secondary); margin-top: 12px;">
                        <div class="step-log-header" style="color: var(--secondary);">
                            <span>▶</span> ${log.title}
                        </div>
                    </div>
                `;
            } else if (log.type === 'transition') {
                const isNewClass = log.isNew ? 'step-new' : '';
                const newBadge = log.isNew ? '<span class="badge-accepted" style="font-size: 0.68rem; margin-left: 6px;">NEW STATE</span>' : '';
                html += `
                    <div class="step-log-card ${isNewClass}" style="margin-left: 16px;">
                        <div class="step-log-header">
                            <span>δ(${log.fromLabel}, ${log.symbol})</span> → <strong>${log.targetLabel}</strong> ${newBadge}
                        </div>
                        <div class="step-log-code">${log.explanation}</div>
                    </div>
                `;
            }
        });
        stepByStepContainer.innerHTML = html;
    }

    // 11. Interactive String Simulator
    function setupSimulation(inputStr) {
        if (!currentDfaResult) {
            alert('Please convert to DFA first!');
            return false;
        }

        simulationTrace = EpsilonNFA.simulateDFA(currentDfaResult, inputStr);
        currentSimStep = 0;
        renderSimulationTape(inputStr);
        updateSimStepView();
        return true;
    }

    function renderSimulationTape(inputStr) {
        simTape.innerHTML = '';
        const chars = inputStr.split('');
        if (chars.length === 0) {
            simTape.innerHTML = `<div class="tape-cell active">λ</div>`;
            return;
        }

        chars.forEach((ch, idx) => {
            const cell = document.createElement('div');
            cell.className = 'tape-cell';
            cell.id = `tape-cell-${idx}`;
            cell.textContent = ch;
            simTape.appendChild(cell);
        });
    }

    function updateSimStepView() {
        if (!simulationTrace) return;
        const traceItem = simulationTrace.trace[currentSimStep];
        if (!traceItem) return;

        simCurrentState.textContent = traceItem.state;
        dfaVisualizer.setActiveStates(traceItem.state);

        const totalChars = simInputString.value.length;
        for (let i = 0; i < totalChars; i++) {
            const cell = document.getElementById(`tape-cell-${i}`);
            if (!cell) continue;
            cell.classList.remove('active', 'processed');
            if (i < currentSimStep) {
                cell.classList.add('processed');
            } else if (i === currentSimStep) {
                cell.classList.add('active');
            }
        }

        if (currentSimStep >= simulationTrace.trace.length - 1) {
            if (simulationTrace.accepted) {
                simResultBadge.innerHTML = `<span class="badge-accepted">✔ ACCEPTED</span>`;
            } else {
                simResultBadge.innerHTML = `<span class="badge-rejected">✖ REJECTED</span>`;
            }
            if (simInterval) {
                clearInterval(simInterval);
                simInterval = null;
                simPlayBtn.textContent = '▶ Play';
            }
        } else {
            simResultBadge.innerHTML = `<span style="color: var(--text-secondary); font-size: 0.82rem;">Step ${currentSimStep + 1} of ${simulationTrace.trace.length}</span>`;
        }
    }

    simPlayBtn.addEventListener('click', () => {
        if (simInterval) {
            clearInterval(simInterval);
            simInterval = null;
            simPlayBtn.textContent = '▶ Play';
            return;
        }

        const inputStr = simInputString.value.trim();
        if (!simulationTrace || currentSimStep >= simulationTrace.trace.length - 1) {
            if (!setupSimulation(inputStr)) return;
        }

        simPlayBtn.textContent = '⏸ Pause';
        simInterval = setInterval(() => {
            if (currentSimStep < simulationTrace.trace.length - 1) {
                currentSimStep++;
                updateSimStepView();
            } else {
                clearInterval(simInterval);
                simInterval = null;
                simPlayBtn.textContent = '▶ Play';
            }
        }, 700);
    });

    simStepNextBtn.addEventListener('click', () => {
        const inputStr = simInputString.value.trim();
        if (!simulationTrace) {
            if (!setupSimulation(inputStr)) return;
            return;
        }
        if (currentSimStep < simulationTrace.trace.length - 1) {
            currentSimStep++;
            updateSimStepView();
        }
    });

    function resetSimulator() {
        if (simInterval) {
            clearInterval(simInterval);
            simInterval = null;
        }
        simPlayBtn.textContent = '▶ Play';
        simulationTrace = null;
        currentSimStep = 0;
        simCurrentState.textContent = '-';
        simResultBadge.innerHTML = '';
        simTape.innerHTML = `<span style="color: var(--text-muted); font-size: 0.85rem;">Enter a string and press Play or Step to visualize the execution path.</span>`;
        if (dfaVisualizer) dfaVisualizer.setActiveStates([]);
    }

    simResetBtn.addEventListener('click', resetSimulator);

    // 12. Preset Examples Loader
    const PRESETS = {
        preset1: {
            title: '(a|b)*ab with ε-transitions',
            statesCount: 4,
            alphabet: 'a, b',
            startState: 'q0',
            finalStates: ['q3'],
            transitions: [
                { from: 'q0', symbol: 'a', to: 'q0' },
                { from: 'q0', symbol: 'b', to: 'q0' },
                { from: 'q0', symbol: 'ε', to: 'q1' },
                { from: 'q1', symbol: 'a', to: 'q2' },
                { from: 'q2', symbol: 'b', to: 'q3' }
            ],
            sampleString: 'aab'
        },
        preset2: {
            title: 'Strings ending in "01"',
            statesCount: 3,
            alphabet: '0, 1',
            startState: 'q0',
            finalStates: ['q2'],
            transitions: [
                { from: 'q0', symbol: '0', to: 'q0' },
                { from: 'q0', symbol: '1', to: 'q0' },
                { from: 'q0', symbol: 'ε', to: 'q1' },
                { from: 'q1', symbol: '0', to: 'q1' },
                { from: 'q1', symbol: '1', to: 'q2' }
            ],
            sampleString: '1001'
        },
        preset3: {
            title: '(0|1)*00(0|1)* with ε-loops',
            statesCount: 3,
            alphabet: '0, 1',
            startState: 'q0',
            finalStates: ['q2'],
            transitions: [
                { from: 'q0', symbol: '0', to: 'q0' },
                { from: 'q0', symbol: '1', to: 'q0' },
                { from: 'q0', symbol: 'ε', to: 'q1' },
                { from: 'q1', symbol: '0', to: 'q2' },
                { from: 'q2', symbol: '0', to: 'q2' },
                { from: 'q2', symbol: '1', to: 'q2' }
            ],
            sampleString: '0100'
        },
        preset4: {
            title: 'Even "a"s or Even "b"s (ε-branching)',
            statesCount: 5,
            alphabet: 'a, b',
            startState: 'q0',
            finalStates: ['q1', 'q3'],
            transitions: [
                { from: 'q0', symbol: 'ε', to: 'q1' },
                { from: 'q0', symbol: 'ε', to: 'q3' },
                { from: 'q1', symbol: 'a', to: 'q2' },
                { from: 'q2', symbol: 'a', to: 'q1' },
                { from: 'q3', symbol: 'b', to: 'q4' },
                { from: 'q4', symbol: 'b', to: 'q3' }
            ],
            sampleString: 'aa'
        }
    };

    function loadPreset(presetKey) {
        const p = PRESETS[presetKey];
        if (!p) return;

        numStatesInput.value = p.statesCount;
        alphabetInput.value = p.alphabet;
        updateStates(p.statesCount);

        nfa.startState = p.startState;
        nfa.finalStates = new Set(p.finalStates);
        nfa.clearTransitions();

        p.transitions.forEach(t => {
            nfa.addTransition(t.from, t.symbol, t.to);
        });

        refreshStateSelectors();
        refreshFinalStateChips();
        renderTransitionMatrix();
        updateNfaVisualization();

        runConversion();

        if (p.sampleString) {
            simInputString.value = p.sampleString;
        }
    }

    presetSelect.addEventListener('change', (e) => {
        loadPreset(e.target.value);
    });

    exportJsonBtn.addEventListener('click', () => {
        const transList = [];
        for (const from in nfa.transitions) {
            for (const sym in nfa.transitions[from]) {
                nfa.transitions[from][sym].forEach(to => {
                    transList.push({ from, symbol: sym, to });
                });
            }
        }
        const data = {
            states: nfa.states,
            alphabet: nfa.alphabet,
            startState: nfa.startState,
            finalStates: Array.from(nfa.finalStates),
            transitions: transList
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'epsilon-nfa-config.json';
        a.click();
        URL.revokeObjectURL(url);
    });

    themeToggleBtn.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
        const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', nextTheme);
    });

    // Initialize Preset 1 on startup
    loadPreset('preset1');
});

// Accordion toggle
window.toggleAccordion = function(id) {
    const item = document.getElementById(id);
    if (item) {
        item.classList.toggle('open');
    }
};
