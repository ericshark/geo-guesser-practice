# Language Samples are bundled ahead of time from open corpora

Language Samples come from openly licensed corpora (Tatoeba, CC-BY) plus hand-written Sign Text, and are bundled into the app at build time. We rejected generating Samples live with an LLM because it needs network access and an API key, and its output is unverified (it can mix languages or invent words). We rejected writing everything by hand because it wouldn't give enough variety to stop the learner from memorizing individual Samples.
