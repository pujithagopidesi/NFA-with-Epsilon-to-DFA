# ε-NFA to DFA Visual Converter (Automata Studio)

A modern, zero-dependency, interactive web application that accepts an **NFA with ε (epsilon transitions)** and converts it to a **DFA (Deterministic Finite Automaton)** using the Subset Construction algorithm and ε-closure computations.

---

## 🌟 Key Features

1. **Automatic Visual State Generation**:
   - Enter the number of states ($q_0$ to $q_n$).
   - States $q_0, q_1, \dots, q_{n-1}$ are automatically generated and rendered on the visual canvas as interactive curved circles.
   - States can be freely dragged and rearranged on the canvas.

2. **State & Alphabet Configuration**:
   - **Initial State**: Select the starting state, denoted with an incoming start arrow ($\rightarrow \bigcirc$).
   - **Final / Accepting States**: Interactive toggleable chips (or click states directly) that render standard double concentric circles ($\odot$).
   - **Input Alphabet ($\Sigma$)**: Comma-separated symbols (e.g. `0, 1` or `a, b`). The symbol $\varepsilon$ (epsilon) is automatically available for transitions.

3. **Transitions & Directed Arrows**:
   - **Directed Curved Arrows**: Bidirectional transitions curve gracefully so arrows do not overlap.
   - **Self-Loops**: Rendered as circular arcs above the state.
   - **Multiple Inputs**: Merged cleanly on arrow labels (e.g. `a, b`).
   - **Flexible Input Methods**:
     - Quick Add form: `[From] [Symbol] [To] [+ Add]`.
     - Full Transition Matrix Table: live editable grid with multi-state support (e.g. `q1, q2`).
     - State click interactions.

4. **Conversion to DFA**:
   - **ε-Closure Computation**: Table detailing $\varepsilon\text{-closure}(q)$ for every state.
   - **Step-by-Step Subset Construction**: In-depth mathematical explanation for every state and input symbol.
   - **DFA Transition Table**: Complete transition matrix with start state ($\rightarrow$) and accepting states ($*$).
   - **Visual DFA Graph**: Rendered with state subsets (e.g. $A = \{q_0, q_1\}$), double circles for final states, and transition arrows.
   - **Dead State Option**: Toggle optional trap state ($\emptyset$) inclusion.

5. **Interactive String Simulator**:
   - Enter any test string (e.g., `0101`, `aab`).
   - Play/Pause or Step through the string.
   - Highlights the active state in real-time on the DFA canvas with glowing ring.
   - Displays clear **ACCEPTED** (green) or **REJECTED** (red) verdicts.

6. **Presets & Export**:
   - 4 preloaded classic textbook automata problems for instant testing.
   - Export SVG diagram.
   - Export/Import JSON automata configuration.
   - Light/Dark theme toggle.

---

## 🚀 How to Run

Since the application uses pure client-side web technologies (HTML5, CSS3, ES6 JavaScript, SVG), **no installation or build step is required**.

### Option 1: Direct Browser Opening
Simply double-click `index.html` or open it in any web browser (Google Chrome, Microsoft Edge, Mozilla Firefox, Brave, Safari).

### Option 2: Via PowerShell
Run the following command in PowerShell:
```powershell
Start-Process "index.html"
```
Or with Microsoft Edge:
```powershell
Start-Process msedge "C:\Users\Dell\.gemini\antigravity\scratch\nfa-to-dfa-app\index.html"
```
