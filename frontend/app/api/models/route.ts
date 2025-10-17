import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: 'OpenRouter API key not configured' },
      { status: 400 }
    );
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const data = await response.json();

    // Filter and format the models
    const models = data.data
      .filter((model: any) => model.id && model.name)
      .map((model: any) => ({
        id: model.id,
        name: model.name,
        pricing: model.pricing,
      }));

    return NextResponse.json(models);
  } catch (error) {
    console.error('OpenRouter models API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch models from OpenRouter' },
      { status: 500 }
    );
  }
}