# ANYTHINGLLM - Copy/Paste Payloads for AI Coder

Purpose: Provide the exact curl commands and raw JSON outputs from the
AnythingLLM endpoints used to validate architectural settings. These
blocks are copy-paste ready for feeding into an AI coder or validator.

IMPORTANT: These files and commands use live service endpoints and an API
key found in the repo `.env`. Treat the API key as a secret.

---

## Commands (copy and run)

1) Global System Configuration (LLM Provider and Vector DB)

```
curl -X GET 'https://ahmad-anything-llm.840tjq.easypanel.host/api/v1/system' \
  -H 'Authorization: Bearer 0G0WTZ3-6ZX4D20-H35VBRG-9059WPA'
```

2) Workspace `generate` (Temperature, History, Mode)

```
curl -X GET 'https://ahmad-anything-llm.840tjq.easypanel.host/api/v1/workspace/generate' \
  -H 'Authorization: Bearer 0G0WTZ3-6ZX4D20-H35VBRG-9059WPA'
```

---

## Raw JSON payloads (copy-paste-ready)

### 1) /api/v1/system

```json
{"settings":{"RequiresAuth":false,"AuthToken":false,"JWTSecret":true,"StorageDir":"/app/server/storage","MultiUserMode":true,"DisableTelemetry":"false","EmbeddingEngine":"ollama","HasExistingEmbeddings":true,"HasCachedEmbeddings":true,"EmbeddingBasePath":"https://ahmad-ollama.840tjq.easypanel.host","EmbeddingModelPref":"embeddinggemma:latest","EmbeddingModelMaxChunkLength":"2000","VoyageAiApiKey":false,"GenericOpenAiEmbeddingApiKey":false,"GenericOpenAiEmbeddingMaxConcurrentChunks":500,"GeminiEmbeddingApiKey":false,"VectorDB":"lancedb","PineConeKey":false,"ChromaApiKey":false,"ChromaCloudApiKey":false,"MilvusPassword":false,"PGVectorConnectionString":false,"PGVectorTableName":"anythingllm_vectors","LLMProvider":"generic-openai","LLMModel":"glm-4.6","OpenAiKey":false,"OpenAiModelPref":"gpt-4o","AzureOpenAiKey":false,"AzureOpenAiEmbeddingModelPref":"embeddinggemma:latest","AzureOpenAiTokenLimit":4096,"AzureOpenAiModelType":"default","AnthropicApiKey":false,"AnthropicModelPref":"claude-2","GeminiLLMApiKey":false,"GeminiLLMModelPref":"gemini-2.0-flash-lite","GeminiSafetySetting":"BLOCK_MEDIUM_AND_ABOVE","LMStudioTokenLimit":null,"LocalAiApiKey":false,"OllamaLLMAuthToken":false,"OllamaLLMTokenLimit":null,"OllamaLLMKeepAliveSeconds":300,"OllamaLLMPerformanceMode":"base","NovitaLLMApiKey":false,"TogetherAiApiKey":false,"FireworksAiLLMApiKey":false,"PerplexityApiKey":false,"OpenRouterApiKey":true,"OpenRouterModelPref":"moonshotai/kimi-k2:free","OpenRouterTimeout":"300000","MistralApiKey":false,"GroqApiKey":true,"GroqModelPref":"moonshotai/kimi-k2-instruct","HuggingFaceLLMAccessToken":false,"TextGenWebUIAPIKey":false,"LiteLLMApiKey":false,"MoonshotAiApiKey":false,"MoonshotAiModelPref":"moonshot-v1-32k","GenericOpenAiBasePath":"https://api.z.ai/api/coding/paas/v4","GenericOpenAiModelPref":"glm-4.6","GenericOpenAiTokenLimit":"9898","GenericOpenAiKey":true,"GenericOpenAiMaxTokens":"100000","AwsBedrockLLMConnectionMethod":"iam","AwsBedrockLLMAccessKeyId":false,"AwsBedrockLLMAccessKey":false,"AwsBedrockLLMSessionToken":false,"AwsBedrockLLMTokenLimit":8192,"AwsBedrockLLMMaxOutputTokens":4096,"CohereApiKey":false,"DeepSeekApiKey":false,"ApipieLLMApiKey":false,"XAIApiKey":false,"PPIOApiKey":false,"DellProAiStudioTokenLimit":4096,"CometApiLLMApiKey":false,"WhisperProvider":"local","WhisperModelPref":"Xenova/whisper-small","TextToSpeechProvider":"native","TTSOpenAIKey":false,"TTSElevenLabsKey":false,"TTSPiperTTSVoiceModel":"en_US-hfc_female-medium","TTSOpenAICompatibleKey":false,"AgentGoogleSearchEngineId":null,"AgentGoogleSearchEngineKey":null,"AgentSearchApiKey":null,"AgentSearchApiEngine":"google","AgentSerperApiKey":null,"AgentBingSearchApiKey":null,"AgentSerplyApiKey":null,"AgentSearXNGApiUrl":null,"AgentTavilyApiKey":null,"AgentExaApiKey":null,"DisableViewChatHistory":false,"SimpleSSOEnabled":false,"SimpleSSONoLogin":false,"SimpleSSONoLoginRedirect":null}}
```

Key fields to check quickly:
- `VectorDB`: "lancedb"
- `LLMProvider`: "generic-openai"
- `LLMModel`: "glm-4.6"
- `EmbeddingEngine`: "ollama"
- `OpenRouterApiKey`, `GroqApiKey`, `GenericOpenAiKey` show `true` (keys present)

### 2) /api/v1/workspace/generate

```json
{"workspace":[{"id":730,"name":"generate","slug":"generate","vectorTag":null,"createdAt":"2025-11-12T20:57:58.256Z","openAiTemp":0.7,"openAiHistory":20,"lastUpdatedAt":"2025-11-12T20:57:58.256Z","openAiPrompt":"You are SOWcial Garden AI, the senior AI Proposal Specialist for Social Garden. Your primary function is to analyze client requirements and leverage Social Garden's internal knowledge to generate comprehensive, accurate, and client-ready Scopes of Work (SOWs). Your output must be in clear, human-readable text, using basic Markdown for structure.\nHIERARCHY OF INSTRUCTIONS (NON-NEGOTIABLE)\nYou will obey these rules in descending order of authority. A higher rule always overrides a lower one.\nTHE USER'S PROMPT IS SUPREME: Any specific instructions, roles, hours, or budget provided in the user's ad-hoc prompt are the highest authority and MUST be followed exactly, even if they contradict the general rules below.\nTHE RATE CARD IS THE ONLY SOURCE OF TRUTH: The [OFFICIAL_RATE_CARD] is the only valid source for roles and rates.\nMANDATORY ROLES ARE CONDITIONAL: The [MANDATORY ROLE INCLUSION] protocol applies ONLY IF the user's prompt does NOT specify a team composition. If the user provides roles, you use their roles and ignore the mandatory ones.\nNON-NEGOTIABLE WORKFLOW & ASSEMBLY\nSTEP 1: ANALYZE & PLAN (INTERNAL THOUGHT PROCESS)\nDeconstruct the user's request to identify the client name, objectives, deliverables, budget, and any specified team members or discounts.\nFor each type of work needed (e.g., \"design,\" \"development,\" \"strategy\"), scan the [OFFICIAL_RATE_CARD] and map it to the EXACT matching role name. You are forbidden from inventing or using \"closest match\" roles.\nIf a budget is provided, calculate the target pre-GST subtotal and plan your hour allocations to meet this target precisely.\nFor each scope, internally generate the two required components: the client-facing prose and the data-only JSON block.\nInternally generate the final [INVESTMENT_OVERVIEW] markdown table.\nSTEP 2: ASSEMBLE & OUTPUT THE SOW\nYou will now assemble the final SOW for output. Your response must follow this sequence precisely.\nStart DIRECTLY with Client: [Client Name]. No introductory text.\nAdd a [PROJECT_OVERVIEW] and [PROJECT_OBJECTIVES].\nAssemble the scopes in the CRITICAL ASSEMBLY ORDER below. You are forbidden from altering this sequence.\nCRITICAL ASSEMBLY ORDER:\nOutput the [PROSE_FOR_SCOPE_1].\nImmediately after, output the [JSON_FOR_SCOPE_1].\nOutput the [PROSE_FOR_SCOPE_2].\nImmediately after, output the [JSON_FOR_SCOPE_2].\n(Continue this pattern for any additional scopes).\nAs the very final step, output the [INVESTMENT_OVERVIEW] summary table you generated in Step 1. The table must list each scope_name and its final scope_total, followed by a Grand Total.\nCore Rules & Reference Data\n[MANDATORY ROLE INCLUSION]\nThis protocol applies ONLY IF the user's prompt does not provide a specific list of roles.\nEach SOW must include appropriate hours for a Project Management - Project Manager.\nEach SOW must include appropriate hours for an Account Management - Senior Account Manager.\n[FINANCIAL_RULES]\nAll currency is in AUD. All final costs in tables must be shown as + GST.\nCalculations must be exact. No rounding.\ncost = hours × rate\nscope_subtotal = SUM of all cost values in that scope.\ndiscount_amount = scope_subtotal * (discount_percent / 100).\nsubtotal_after_discount = scope_subtotal - discount_amount.\ngst_amount = subtotal_after_discount * 0.10.\nscope_total = subtotal_after_discount + gst_amount.\n[OFFICIAL_RATE_CARD]\n(.... long rate card content omitted for brevity in this display)\n","similarityThreshold":0.25,"chatProvider":"generic-openai","chatModel":"glm-4.6","topN":4,"chatMode":"chat","pfpFilename":null,"agentProvider":null,"agentModel":null,"queryRefusalResponse":"There is no relevant information in this workspace to answer your query.","vectorSearchMode":"default","documents":[],"threads":[{"user_id":1,"slug":"f611392d-36c7-418d-bc08-cdc236f109d3"},{"user_id":null,"slug":"66b247c3-720a-4e38-88bb-90c7982ede93"}]}]}
```

Key fields to check quickly:
- `openAiTemp`: 0.7
- `openAiHistory`: 20
- `openAiPrompt`: the workspace prompt controlling SOW generation (long, strict rules)

---

## Files saved in repo

- `/root/the11-dev/docs/anythingllm-system.json` — raw system JSON
- `/root/the11-dev/docs/anythingllm-workspace-generate.json` — raw workspace JSON

## Next steps you can ask me to do

- Add a short summary into `TECHNICAL-OVERVIEW.md` referencing these
  settings.
- Open a PR with these docs on branch `docs/anythingllm-config`.
- Convert the workspace prompt into a sanitized, shorter spec if you want
  to give to an external AI coder.

---

If you want the JSON differently formatted (pretty-printed, minified, or
as separate variables for an AI coder), tell me which format and I'll
update the files.
