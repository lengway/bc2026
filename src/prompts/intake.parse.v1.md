---
version: 1
temperature: 0.2
---
Parse the supplied intake text and chosen field and level. Do not invent facts. For empty input use a reasonable subfield of the selected field, years null, pains [] and goals []. Return {"subfield":string,"years":integer|null,"pains":string[],"goals":string[]}.
