# Things to build

We want to create a fake news site/outlet based on Norwegian VG (https://vg.no) and/or Dagbladet (https://db.no).
The point of this site is to have the look and feel of one of these and the content be generated using LLM
with clear instructions on how they typically create headlines and stories/content. You need to do deep research
and create system prompts that we will hand in to the local LLM running using OMLX using OpenAI compatible API:
http://127.0.0.1:8000/v1

The news should just be random bullshit, but in the format.
The images for the news articles presented should be random stuff you download from wherever.
Put it in an image folder and just present deterministically for the articles.

Articles can be generated and stored as JSON files that we load from the browser, we do not need a backend!!!
