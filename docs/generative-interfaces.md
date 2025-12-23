Briefing on Generative User Interfaces

Executive Summary

Generative User Interface (UI) represents a paradigm shift in software development, where Large Language Models (LLMs) move beyond generating static content like text or images to creating entire, custom, and interactive user experiences from a simple prompt. This approach replaces predefined interfaces with dynamic, ephemeral applications tailored to a user's specific, immediate need. Research and practical tutorials demonstrate two primary methodologies: direct code generation, where an LLM outputs raw HTML, CSS, and JavaScript; and a more structured, model-based approach that uses an intermediate "task-driven data model" to generate a malleable UI that users can iteratively refine.

User preference studies show that AI-generated UIs are overwhelmingly preferred over the standard markdown "wall of text" output from LLMs, with one study finding an 82.8% preference rate. While not yet matching the quality of human-expert-designed websites, the performance of Generative UI is rapidly improving and is considered an emergent capability of the latest models like Gemini 3, which produce fewer errors and achieve higher user satisfaction scores.

However, building these complex, streaming, and interactive AI applications introduces significant engineering challenges, particularly in state management. Traditional methods using simple booleans (useState) are prone to creating "impossible states" and bugs when dealing with race conditions, user interruptions, and network failures. The recommended solution is to adopt finite state machines (FSM), using tools like useReducer for simple flows and advanced libraries such as XState for complex orchestration, ensuring UI correctness and maintainability. The overarching vision is a future with an "infinite catalog" of applications, where the perfect interface for any task is generated on the spot.

The Paradigm of Generative UI

Defining Generative and Malleable Interfaces

Generative UI is a modality where an AI model generates not only content but the entire user experience in response to a prompt. This results in custom, interactive experiences that can include rich formatting, images, maps, audio, and even full applications like simulations and games. This concept effectively creates an "instant AI team" of product management, UX design, and engineering to build a bespoke interface for a specific prompt, moving far beyond the static "walls-of-text" typical of current LLM interactions.

A closely related concept is the Malleable UI, which emphasizes the ability for end-users to iteratively tailor and extend a generated interface to their evolving needs. This is achieved by allowing users to modify the UI through continuous natural language prompts and direct manipulation, which in turn updates an underlying data model that drives the interface's structure and behavior.

Moving Beyond Static Markdown and Templated UIs

The current, prevalent interface for LLMs is a markdown-based chat format. While an improvement over plain text, this modality remains inherently static. Some systems have explored a middle ground termed "Templated UI," where an LLM can invoke and populate predefined interactive widgets from a fixed library. Generative UI represents a significant leap forward from both approaches by allowing the model to generate the UI itself, unlocking the potential for bespoke and highly contextual experiences.

Core Approaches to UI Generation

The provided context outlines three distinct but related approaches to building Generative UIs.

1. Direct Code Generation from Prompts

This is the most direct approach, where an LLM is prompted to generate the complete codebase for a user interface. The model outputs raw HTML, CSS, and JavaScript, which is then rendered in a browser.

* Process: The system relies on a carefully crafted system prompt that provides the LLM with a "core philosophy" (e.g., "Build Interactive Apps First"), technical instructions, and examples. The LLM then generates a single, fully-functional web page.
* Strengths: Can produce visually stunning, rich applications from a single prompt, including games, educational tools, and data visualizations.
* Challenges: The direct relationship between prompt and code can be opaque, making it difficult for end-users to modify or extend the interface reliably. A new prompt may result in a discontinuous transition between codebases, and the model can occasionally produce errors (JS, CSS, HTML). This approach is used in the Next.js tutorial and the Google Research paper.

2. Model-Based Generation with Task-Driven Data Models

This approach introduces a higher-level abstraction between the user's prompt and the UI code. Instead of generating code directly, the LLM first generates a task-driven data model that represents the essential information, entities, and relationships for the user's task. This model then serves as the foundation for generating UI specifications, which in turn render the final interface.

* Core Components:
  * Object-Relational Schema: Describes the types of entities required for a task (e.g., Recipe, Ingredient), their attributes (e.g., name, quantity), and relationships.
  * Dependency Graph: Defines relationships across entities, such as validation rules (e.g., checkout date must be after check-in date) or automatic updates (e.g., total calories recalculate when ingredients change).
* Process: The system analyzes a user prompt, generates the data model, translates the model into a UI specification using mapping rules, and then renders the UI. User follow-up prompts modify the underlying model, which seamlessly updates the UI.
* Strengths: Creates a "malleable" and interpretable UI. Users can inspect the model to understand the UI's structure and have more control. It avoids the discontinuity of direct code generation, making iterative refinement more robust. This is the approach detailed in the "Jelly" system paper.

3. Agent-Powered Interactive Frameworks

This approach uses an AI agent, powered by a model like Gemini, to manage state and interact with a dedicated UI framework. The agent receives prompts, generates content, and uses the framework to display that content in interactive components.

* Process: The agent communicates with a "content generator" which acts as an adapter to the UI framework. The agent can be prompted to expect user input and wait for confirmation before proceeding, allowing for a conversational, back-and-forth interaction. Users can request changes, and the agent updates the UI components accordingly.
* Example: In a Flutter workout app, a user asks for a workout plan. The agent generates the exercises and displays them in "reps card" widgets. The user can then ask for modifications ("I don't have enough time"), and the agent updates the plan. The UI widgets themselves can send information back to the agent (e.g., recording completed reps).
* Strengths: Enables highly interactive, stateful applications where the user and the AI agent collaborate in real-time.

Technical Deep Dive: Implementation Strategies

Case Study 1: A Next.js and Gemini UI Generator

A tutorial by Avinash Prasad outlines a practical implementation of direct code generation using modern web technologies.

1. Project Setup: A new Next.js 13.4 project is created using the App Router, with Tailwind CSS for styling and JavaScript.
2. Frontend: A simple page.js component is built with an input field for the prompt, a button to trigger generation, and a placeholder div to display the result. React state variables (useState) are used to manage the user's prompt and the generated code.
3. Backend API Route: A Next.js route handler is created at /api/generate/route.js. This server-side function uses the @google/generative-ai SDK to interact with the Gemini API.
4. Prompt Engineering: The user's input is not passed directly to the model. Instead, "prompt injection" is used to add instructions, ensuring the model's output is in the desired format: data.body + " . Write jsx code and use tailwindcss for modern UI. Don't make any imports. Only output code. ". This controls the output to be pure JSX with Tailwind classes.
5. Client-Side Fetch: A client-side function (handleGenerate) sends a POST request to the /api/generate endpoint with the user's prompt in the request body. The JSON response containing the generated code is then stored in the code state variable.
6. Rendering: The generated code string is initially just displayed as text. To render it as a real UI, the html-react-parser library is used to convert the string into live JSX components.

Case Study 2: Google's End-to-End Web Page Generation

The Google Research paper describes a more advanced system for direct code generation that produces entire interactive web pages.

* System Prompt: A key component is a meticulously crafted system prompt (~3K words) that guides the LLM. It includes:
  * Core Philosophy: Rules like "Build Interactive Apps First," "No walls of text," and mandatory fact verification via search for entities.
  * Examples: Detailed examples of good outputs for specific prompts (e.g., a "Clock Application" for "what's the time?").
  * Technical Details: Instructions on using Tailwind CSS, handling images via specific endpoints (/gen for generative, /image for search), and outputting only raw HTML between exact markers.
* Post-Processors: After generation, the system runs a series of post-processors to fix common issues, such as replacing API key placeholders, fixing JavaScript parsing errors, and correcting CSS problems.
* Output: The system produces a single, fully-generated HTML web page with accompanying assets like images, capable of creating complex applications like a fractal explorer, a memory game, or an educational math app.

Case Study 3: The "Jelly" System's Malleable UI Pipeline

The Jelly system exemplifies the model-based approach, focusing on creating an interface that can evolve with a user's task.

1. Task Analysis: The pipeline begins by using an LLM to analyze the user's prompt, infer their goals, and derive sub-tasks.
2. Data Model Generation: The LLM generates the Task-Driven Data Model, which includes the object-relational schema and a dependency graph.
3. UI Specification Generation: The data model is translated into a UI Specification. This is done by annotating each attribute in the schema with labels that define its function (e.g., display), rendering type (e.g., time, location), and editability. This specification-based approach ensures consistency and quality.
4. UI Rendering: The system renders the UI based on a predefined set of rules that map the specification labels to concrete UI widgets.
5. Continuous Customization: Users provide follow-up prompts. The system parses these requests into update operations ({Target, Action, Specifications}) that modify the underlying data model, which in turn drives real-time updates to the UI.

The State Management Imperative in Complex AI Interfaces

The shift towards dynamic, streaming AI-powered UIs creates significant challenges for frontend state management, making traditional approaches fragile and bug-prone.

The Failure of Boolean State Management and "Impossible States"

Using a collection of useState boolean flags (isLoading, isStreaming, isComplete, isError) to manage the lifecycle of an AI feature is a common but flawed pattern. This approach creates a high risk of "impossible states," where mutually exclusive conditions can become true simultaneously. For example:

* What should the UI render if isLoading and isComplete are both true?
* How should it behave if isError has a value but isStreaming is also true? This ambiguity leads to confusing user experiences and difficult-to-debug side effects. The developer is left "manually choreographing a ballet of booleans," a process that is fragile and imperative.

Production Challenges in AI Streaming UX

A generative UI that streams responses from an LLM introduces several production-level challenges that simple state management cannot handle gracefully:

Challenge	Description	Why useState Fails
Race Conditions	A user submits a new prompt while a previous response is still streaming.	There is no built-in mechanism to cancel the first stream or queue the second. Checking boolean flags leads to complex conditional logic.
Network Failures Mid-Stream	The connection drops while receiving a response.	Juggling multiple states (isStreaming, hasError, partialData) simultaneously leads to desynchronization and impossible states.
User Interruptions	A user clicks a "Cancel" button during a stream.	Manually coordinating the cleanup (aborting fetch, clearing data) is complex. A "Regenerate" click during cancellation can create new impossible states.
Conditional Retry Logic	The system should only allow retries from an error state, not from a streaming or complete state.	Enforcing these rules requires nested if statements checking multiple booleans, which is not robust.
Parallel Context Updates	While streaming, multiple pieces of data (accumulated text, token count, time elapsed) are updated.	Separate setState calls (setText(), setTokens()) can become desynchronized, especially if an error occurs mid-update.

Solution: Finite State Machines for Orchestration

A Finite State Machine (FSM) is a computational model that can be in exactly one of a finite number of states at any given time. This model eliminates impossible states by design.

* useReducer: For simple to moderate needs (e.g., basic async flows), React's built-in useReducer hook is a significant improvement. It centralizes state transitions and makes impossible states structurally impossible. However, it struggles with complex side effects like race condition prevention and guarded transitions, often requiring manual management with useEffect.
* XState: For complex orchestration like AI streaming, XState is the recommended tool. It extends FSMs with features critical for real-world scenarios:
  * Guards: Conditional transitions that prevent actions under certain conditions (e.g., block a new request while streaming).
  * Entry/Exit Actions: Cleanly manage side effects when entering or leaving a state (e.g., clear previous results on a new submission but preserve them on error).
  * Deterministic Transitions: The next state is always predictable, eliminating ambiguity.
  * Unified Context: All related data is updated atomically, preventing desynchronization.

Performance and User Preference Analysis

A Google Research study evaluated their Generative UI implementation against several baselines using human raters.

Human Rater Evaluations: Generative UI vs. Alternatives

The study compared user preferences for results from different formats, including human-expert-crafted websites, Generative UI, standard LLM markdown, top Google Search results, and plain text LLM output.

* ELO Score Comparison (LMArena Prompts): ELO scores measure relative preference. Higher is better.

Format	ELO Score
Website (human expert)	1756.0
Generative UI	1710.7
Generative Markdown	1459.6
Website (top search result)	1355.1
Generative Text	1218.6

* Pairwise Preference Wins (LMArena Prompts): This table shows the percentage of time one format was preferred over another.

Method	vs. Custom Website (expert)	vs. Generative UI	vs. Markdown	vs. Website (search)	vs. Text
Generative UI	43.0%	-	82.8%	90.0%	97.0%

Key Takeaways:

* Generative UI is overwhelmingly preferred by users over standard markdown (82.8% of the time) and plain text (97.0%).
* While human-expert websites are still preferred over Generative UI (56.0% vs. 43.0%), the AI-generated results are comparable in 44% of cases.

An Emergent Capability of Modern LLMs

The study demonstrates that the ability to robustly produce high-quality UIs is an emergent capability of newer, more advanced LLMs. As models improve, so does the quality of the generated UI.

Backbone Model	Elo Score (LMArena)	Output Errors
Gemini 3	1706.7	0%
Gemini 2.5 Pro	1653.6	0%
Gemini 2.5 Flash	1623.9	0%
Gemini 2.0 Flash	1332.9	29%
Gemini 2.0 Flash-Lite	1183.0	60%

The PAGEN Dataset for Benchmarking

To facilitate consistent evaluation of Generative UI systems, researchers created and released PAGEN, a dataset of expert-human-made websites for a sample of prompts. The dataset was constructed by contracting highly-rated independent web developers to ensure a clear pairing between a prompt and a high-quality resulting website.

Core Challenges and Future Directions

Current Limitations

* Slow Generation Speed: Creating a complex UI can take a minute or two, which is a primary area for future research. Streaming results can partially mitigate this.
* Generation Errors: AI-generated code can occasionally contain JavaScript, CSS, or HTML errors that require post-processing or manual correction.
* Lack of Malleability in Direct Generation: When code is generated directly, it is difficult for non-expert users to iteratively refine or customize the UI. Each new prompt can lead to a completely different codebase.
* Need for Higher-Level Abstractions: To address the malleability issue and state management complexity, higher-level structures like task-driven data models and state machines are necessary.
* Limited Expressiveness: The quality and variety of generated UIs are constrained by the system's specifications and design patterns. More comprehensive specifications are needed to support diverse layouts and advanced interactions.

The Vision for Personalized, Ephemeral Interfaces

The long-term vision for Generative UI is a fundamental change in how users interact with software. Instead of being limited to a finite library of predefined applications, users will have access to an "infinite catalog" where the ideal, ephemeral interface is generated on the spot, perfectly tailored to their needs. This will enable dynamic and personalized information spaces that adapt to a user's evolving goals, allowing them to flexibly curate diverse information and customize its representation. The ultimate goal is to create interfaces that are not only generative and malleable but also truly personal.
