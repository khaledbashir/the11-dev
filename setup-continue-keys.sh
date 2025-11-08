#!/bin/bash

echo "🔑 Setting up Continue IDE API Keys"
echo "=================================="

# Check if user wants to set up OpenAI
echo ""
read -p "Do you have an OpenAI API key? (y/n): " has_openai
if [[ $has_openai == "y" || $has_openai == "Y" ]]; then
    read -p "Enter your OpenAI API key: " openai_key
    export OPENAI_API_KEY="$openai_key"
    echo "✅ OpenAI API key set for this session"
    echo "   To make it permanent, add to your ~/.bashrc:"
    echo "   export OPENAI_API_KEY=\"$openai_key\""
fi

# Check if user wants to set up Groq (free)
echo ""
read -p "Do you want to set up Groq (free tier available)? (y/n): " has_groq
if [[ $has_groq == "y" || $has_groq == "Y" ]]; then
    echo "📝 Get your free Groq API key from: https://console.groq.com/keys"
    read -p "Enter your Groq API key: " groq_key
    export GROQ_API_KEY="$groq_key"
    echo "✅ Groq API key set for this session"
    echo "   To make it permanent, add to your ~/.bashrc:"
    echo "   export GROQ_API_KEY=\"$groq_key\""
fi

echo ""
echo "🔄 Restart Continue IDE to apply the changes"
echo "💡 If you still get errors, try setting the keys in VS Code settings:"