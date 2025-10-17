import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Using AnythingLLM now - return list of available models
  // These are the models available through AnythingLLM workspace "pop"
  const models = [
    {
      id: 'anythingllm-gpt4',
      name: 'GPT-4 (via AnythingLLM)',
      provider: 'anythingllm',
    },
    {
      id: 'anythingllm-gpt35',
      name: 'GPT-3.5 (via AnythingLLM)',
      provider: 'anythingllm',
    },
    {
      id: 'anythingllm-claude',
      name: 'Claude (via AnythingLLM)',
      provider: 'anythingllm',
    },
  ];

  return NextResponse.json(models);
}