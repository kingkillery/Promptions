# Promptions

## OVERVIEW

Promptions is a simple and flexible **dynamic prompt middleware UI for AI technique**. From a single, simple, prompt, the system helps users steer the AI, customizing their outputs by suggesting parameterized choices in the form of dynamically generated user interface components​. As the user clicks on choices, they get immediate changes to the same output, not just additional chat responses. Dynamic UI can be per-prompt and per-session.

### What Can Promptions Do

Promptions was developed as a simple technique to help AI end-user application developers improve their users' AI steering experiences, to get more value from their application.
A detailed discussion of Promptions, including how it was developed and tested, can be found in our paper at: https://aka.ms/promptionspaper.

### Intended Uses

Promptions is best suited for incorporating into any end-user user interface in which parameterization of prompts to add further context would help steer the output to the user's preferences, without having to write or speak the context. The technique is simple but effective, and can be easily customized to fit any application, suiting developers from individual vibe-coders to those in enterprise.

| Real-world use                        | Description                                                                                                                                                                                     |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Customer support chatbots             | Users refine support queries on the fly (e.g., specify tone or detail level) and see updated answers instantly, improving resolution speed and satisfaction.                                    |
| Content creation platforms            | Writers and marketers tweak style, length, or format parameters through GUI controls, iterating drafts faster while maintaining creative direction.                                             |
| Data analytics and BI dashboards      | Analysts adjust filters, aggregation levels, or visualization styles via checkboxes and sliders, regenerating AI-driven reports and insights instantly.                                         |
| Educational tutoring systems          | Students select difficulty, focus topics, or feedback style, prompting the AI tutor to adapt explanations and examples to individual learning needs.                                            |
| Healthcare decision-support tools     | Clinicians refine symptom context, risk factors, or treatment priorities through guided options, obtaining tailored diagnostic suggestions and care pathways.                                   |
| Data annotation and curation          | Promptions can parameterize labeling decisions into structured GUI inputs (e.g. sentiment sliders, style toggles), improving consistency, speed, and auditability in dataset creation.          |
| Interactive explainability & auditing | Promptions allows users to explore how AI outputs shift with different refinement choices, offering a lightweight way to probe bias, model boundaries, or failure modes through UI interaction. |
| Human-AI co-creation experiments      | Promptions enables controlled studies of creative workflows—researchers can observe how users interact with dynamic controls vs. freeform input when generating stories, resumes, or code.      |

Promptions is being shared with the research community to facilitate reproduction of our results and foster further research in this area.
Promptions is intended to be used by domain experts who are independently capable of evaluating the quality of outputs before acting on them.

### Out-of-Scope Uses

Promptions is not well suited for high-stakes or compliance-critical domains where outputs must follow strict regulatory standards (e.g., legal filings, medical diagnoses, or financial disclosures). In these contexts, dynamically steerable AI interfaces may introduce ambiguity, variation, or unintended bias that conflicts with traceability and audit requirements. It is also not designed for tasks requiring long-form reasoning chains, deeply nested prompt dependencies, or multi-modal coordination (e.g., simultaneous visual + textual generation), as its UI paradigm prioritizes simplicity and responsiveness over complex workflow orchestration.

We do not recommend using Promptions in commercial or real-world applications without further testing and development. It is being released for research purposes.

Promptions was not designed or evaluated for all possible downstream purposes. Developers should consider its inherent limitations as they select use cases, and evaluate and mitigate for accuracy, safety, and fairness concerns specific to each intended downstream use.

Promptions should not be used in highly regulated domains where inaccurate outputs could suggest actions that lead to injury or negatively impact an individual's legal, financial, or life opportunities.

We do not recommend using Promptions in the context of high-risk decision making (e.g. in law enforcement, legal, finance, or healthcare).

Promptions does not provide medical or clinical opinions and is not designed to replace the role of qualified medical professionals in appropriately identifying, assessing, diagnosing, or managing medical conditions.

## HOW TO GET STARTED

To begin using Promptions, follow instructions at [microsoft/promptions](https://github.com/microsoft/promptions/)

## EVALUATION

Promptions was evaluated on its ability to explain spreadsheet formulas, python code, short text passages, and as a teaching aid for data analysis and visualization concepts
A detailed discussion of our evaluation methods and results can be found in our paper at: https://aka.ms/promptionspaper.

### Evaluation Methods

We used user preferences to measure Promptions' performance.
We used a comparative user lab study to measure user preferences for Promptions dynamic UI against a static options system.
The model used for evaluation was gpt4-turbo. For more on this specific model, please see https://platform.openai.com/docs/models/gpt-4-turbo.
Results may vary if Promptions is used with a different model, or when using other models for evaluation, based on their unique design, configuration and training.
In addition to robust quality performance testing, Promptions was assessed from a Responsible AI perspective. Based on these results, we implemented mitigations to minimize Promption's susceptibility to misuse.

### Evaluation Results

At a high level, we found that, compared to a Static prompt refinement approach, the Promptions Dynamic prompt refinement approach afforded more control, lowered barriers to providing context, and encouraged task exploration and reflection, but reasoning about the effects of generated controls on the final output remains challenging. Our findings suggest that dynamic prompt middleware can improve the user experience of generative AI workflows.

## LIMITATIONS

Promptions was developed for research and experimental purposes. Further testing and validation are needed before considering its application in commercial or real-world scenarios.

Promptions was designed and tested using the English language. Performance in other languages may vary and should be assessed by someone who is both an expert in the expected outputs and a native speaker of that language.
Promptions' outputs generated by AI return options non-deterministically. Parameterized choices and outputs are likely to differ across turns and sessions.

Outputs generated by AI may include factual errors, fabrication, or speculation. Users are responsible for assessing the accuracy of generated content. All decisions leveraging outputs of the system should be made with human oversight and not be based solely on system outputs. Promptions inherits any biases, errors, or omissions produced by its base model. Developers are advised to choose an appropriate base LLM/MLLM carefully, depending on the intended use case. Promptions inherits any biases, errors, or omissions characteristic of its training data, which may be amplified by any AI-generated interpretations. Developers are advised to use content mitigations such as Azure Content Moderation APIs and test their systems using a service such as the Azure AI safety evaluations.

There has not been a systematic effort to ensure that systems using Promptions are protected from security vulnerabilities such as indirect prompt injection attacks. Any systems using it should take proactive measures to harden their systems as appropriate.

## BEST PRACTICES

Promptions in a general purpose library for integrating prompt clarifications and elaborations into a generative AI experience through dynamic UI. As with any generative AI experience, options can be hallucinated or incorrect, so human judgment should be applied when considering the output.

The method for generating options is general and broadly applicable, but for specific scenarios better results may be achieved by extending or modifying option generation to include domain specific details, for instance, options of software library supported by your context.

Options are created by LLM's generating JSON and then rendering that JSON using provided UI components. By default, Promptions uses capable LLMs that are highly reliable at generating JSON, but for further reliability constrained decoding (structured outputs) could be applied for simple JSON schemas. If Promptions is extended to generate UI directly via LLM code generation, this code must be executed int a sandboxed environment.

Promptions' sample code integrates with an external LLM API, so sensitive data should not be used.
We strongly encourage users to use LLMs/MLLMs that support robust Responsible AI mitigations, such as Azure Open AI (AOAI) services. Such services continually update their safety and RAI mitigations with the latest industry standards for responsible use. For more on AOAI's best practices when employing foundations models for scripts and applications:

- [Blog post on responsible AI features in AOAI that were presented at Ignite 2023](https://techcommunity.microsoft.com/t5/ai-azure-ai-services-blog/announcing-new-ai-safety-amp-responsible-ai-features-in-azure/ba-p/3983686)
- [Overview of Responsible AI practices for Azure OpenAI models](https://learn.microsoft.com/en-us/legal/cognitive-services/openai/overview)
- [Azure OpenAI Transparency Note](https://learn.microsoft.com/en-us/legal/cognitive-services/openai/transparency-note)
- [OpenAI s Usage policies](https://openai.com/policies/usage-policies)
- [Azure OpenAI s Code of Conduct](https://learn.microsoft.com/en-us/legal/cognitive-services/openai/code-of-conduct)

Users are responsible for sourcing their datasets legally and ethically. This could include securing appropriate copy rights, ensuring consent for use of audio/images, and/or the anonymization of data prior to use in research.
Users are reminded to be mindful of data privacy concerns and are encouraged to review the privacy policies associated with any models and data storage solutions interfacing with Promptions.

It is the user's responsibility to ensure that the use of Promptions complies with relevant data protection regulations and organizational guidelines.

### Suggested Jailbreak Mitigations

Promptions sample code includes components that interact with large language models (LLMs), which may be vulnerable to jailbreak attacks—user-crafted prompts designed to bypass safety instructions. To mitigate the risk of jailbreaks, we recommend a layered approach:

- Metaprompt Defense: Use Microsoft's recommended metaprompt structure, which includes a final instruction explicitly prohibiting the model from revealing or altering its safety rules. This has shown strong resistance to adversarial prompts in internal evaluations.
- Platform Safeguards: Integrate Azure AI safety features such as jailbreak classifiers, content filters, and blocklists to detect and block harmful outputs.
- Developer Responsibility: As this is an open source release, developers are expected to evaluate and adapt the code responsibly. We encourage logging user inputs, avoiding direct exposure of raw model outputs, and applying additional safety layers during deployment.

For more details, see Microsoft's guidance on jailbreak mitigation at [AI jailbreaks: What they are and how they can be mitigated | Microsoft Security Blog.](https://www.microsoft.com/en-us/security/blog/2024/06/04/ai-jailbreaks-what-they-are-and-how-they-can-be-mitigated/)

### Suggestions for Other Mitigations

| Stakeholders/Use Case                                               | Potential harms                                                                                                 | Potential mitigation                                                                                                                                         |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Non-technical end users (chatbots & content creation)               | Overreliance on AI outputs that may contain errors, bias, or outdated information                               | Display confidence/uncertainty indicators; embed disclaimers; require optional “verify with human” step; offer “undo” or revision history features           |
| Business analysts (BI dashboards & reporting)                       | Misinterpreting or overfitting to spurious correlations in AI-generated insights                                | Surface data provenance and model assumptions; limit refinement ranges; mandate manual sign-off on critical metrics; log all parameter changes               |
| Educators & learners (intelligent tutoring systems)                 | Learning from incorrect or oversimplified explanations, reinforcing misconceptions                              | Integrate educator review workflows; flag low-confidence responses; link to curated, authoritative resources; provide error-reporting UI                     |
| Citizen developers (low-code/no-code AI integration)                | Accidentally exposing sensitive data, misconfiguring prompts leading to inappropriate outputs                   | Enforce input sanitization and PII redaction by default; ship with secure templates; include step-by-step integration guides; sandbox testing mode           |
| Organizations & businesses (customer support, marketing, analytics) | Brand/reputation damage from biased or offensive outputs; regulatory non-compliance (e.g., GDPR, FINRA)         | Establish usage governance policies; maintain audit logs; run periodic bias and compliance audits; restrict high-risk refinement options                     |
| Malicious actors (propaganda, phishing, disinformation)             | Crafting highly persuasive or deceptive content at scale; evading content filters through iterative refinements | Implement rate-limiting and anomaly detection; require user authentication and reputation scoring; deploy robust content-safety filters; human review queues |

## LICENSE

Microsoft, and any contributors, grant you a license to any code in the repository under the MIT License. See the LICENSE file. Microsoft and any contributors reserve all other rights, whether under their respective copyrights, patents, or trademarks, whether by implication, estoppel, or otherwise.

```
MIT License

Copyright (c) 2025 Microsoft Corporation

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

## THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## CONTACT

We welcome feedback and collaboration from our audience. If you have suggestions, questions, or observe unexpected/offensive behavior in our technology, please contact us at [promptionsgithub@service.microsoft.com](promptionsgithub@service.microsoft.com).

If the team receives reports of undesired behavior or identifies issues independently, we will update this repository with appropriate mitigations.
