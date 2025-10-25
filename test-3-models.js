#!/usr/bin/env node

/**
 * TEST 6 MODELS - SAME PROMPT
 * 
 * Compares SOW generation across 6 different LLM models via OpenRouter
 * All testing with AnythingLLM workspace with provider: openrouter
 * 
 * Input: "Please create me a scope of work for a client to support them 
 *         with a nurture program build - 5 emails and 2 landing pages 
 *         for HubSpot. At approximately $25,000 cost"
 * 
 * Usage: cd frontend && pnpm tsx ../test-3-models.js
 */

import { AnythingLLMService } from './frontend/lib/anythingllm.js';

const PROD_API_URL = 'https://sow.qandu.me';
const TEST_BRIEF = "Please create me a scope of work for a client to support them with a nurture program build - 5 emails and 2 landing pages for HubSpot. At approximately $25,000 cost";

const MODELS = [
  {
    name: 'MiniMax M2',
    provider: 'openrouter',
    model: 'minimax/minimax-m2:free',
    description: 'Free'
  },
  {
    name: 'Qwen 3 235B',
    provider: 'openrouter',
    model: 'qwen/qwen3-235b-a22b:free',
    description: 'Free'
  },
  {
    name: 'GLM 4.5 Air',
    provider: 'openrouter',
    model: 'z-ai/glm-4.5-air:free',
    description: 'Free'
  },
  {
    name: 'DeepSeek R1',
    provider: 'openrouter',
    model: 'deepseek/deepseek-r1-0528:free',
    description: 'Free'
  },
  {
    name: 'Qwen 3 Coder',
    provider: 'openrouter',
    model: 'qwen/qwen3-coder:free',
    description: 'Free'
  },
  {
    name: 'GPT-4o',
    provider: 'openrouter',
    model: 'openai/gpt-4o',
    description: 'Enterprise'
  }
];

const anythingLLM = new AnythingLLMService();

function log(message, type = 'info') {
  const emoji = { info: '📋', success: '✅', error: '❌', test: '🧪', step: '▶️', model: '🤖' };
  console.log(`${emoji[type] || '➡️'} ${message}`);
}

async function withTimeout(promise, timeoutMs, stepName) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`⏱️ TIMEOUT after ${timeoutMs}ms on: ${stepName}`));
    }, timeoutMs);
  });
  
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId);
  }
}

async function testModel(modelConfig, testNumber) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🧪 TEST ${testNumber}/3: ${modelConfig.name}`);
  console.log(`${modelConfig.description}`);
  console.log(`Provider: ${modelConfig.provider} | Model: ${modelConfig.model}`);
  console.log(`${'='.repeat(80)}\n`);

  let workspace = null;
  let thread = null;
  let sowId = null;
  let fullResponse = '';
  const results = {
    model: modelConfig.name,
    provider: modelConfig.provider,
    modelId: modelConfig.model,
    workspaceSlug: null,
    threadSlug: null,
    sowId: null,
    generatedChars: 0,
    generationTimeMs: 0,
    hasGSTSuffix: false,
    hasJSONTable: false,
    hasClosingPhrase: false,
    hasPlusBullets: false,
    hasRoundNumbers: false,
    hasAccountMgmtBottom: false,
    hasGranularRoles: false,
    requirementsScore: 0,
    maxScore: 7,
    errors: []
  };

  try {
    // --- CREATE WORKSPACE ---
    log(`Creating workspace for ${modelConfig.name}...`, 'step');
    const workspaceId = `test-${modelConfig.model.replace(/[^a-z0-9]/g, '-')}-${Date.now()}`;
    
    workspace = await withTimeout(
      anythingLLM.createOrGetClientWorkspace(workspaceId),
      20000,
      `Create Workspace (${modelConfig.name})`
    );
    
    if (!workspace || !workspace.slug) {
      throw new Error('Workspace creation failed');
    }
    
    results.workspaceSlug = workspace.slug;
    log(`Workspace: ${workspace.slug}`, 'success');

    // --- CONFIGURE LLM PROVIDER ---
    log(`Configuring LLM provider: ${modelConfig.provider}/${modelConfig.model}...`, 'step');
    
    const providerConfigured = await withTimeout(
      anythingLLM.setWorkspaceLLMProvider(workspace.slug, modelConfig.provider, modelConfig.model),
      10000,
      `Configure LLM (${modelConfig.name})`
    );
    
    if (!providerConfigured) {
      log('⚠️ LLM configuration may have incomplete', 'error');
    } else {
      log(`LLM configured: ${modelConfig.provider}/${modelConfig.model}`, 'success');
    }

    // --- CREATE THREAD ---
    log('Creating chat thread...', 'step');
    
    thread = await withTimeout(
      anythingLLM.createThread(workspace.slug),
      10000,
      `Create Thread (${modelConfig.name})`
    );
    
    if (!thread || !thread.slug) {
      throw new Error('Thread creation failed');
    }
    
    results.threadSlug = thread.slug;
    log(`Thread: ${thread.slug}`, 'success');

    // --- GENERATE SOW ---
    log('Generating SOW via streaming chat...', 'step');
    log(`Brief: "${TEST_BRIEF}"`, 'info');
    
    let chunkCount = 0;
    const startTime = Date.now();
    
    console.log('📡 Streaming SOW generation...');
    const progressInterval = setInterval(() => {
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      console.log(`⏳ [${elapsed}s] Chunks: ${chunkCount} | Length: ${fullResponse.length} chars`);
    }, 15000);
    
    try {
      await withTimeout(
        new Promise((resolve, reject) => {
          anythingLLM.streamChatWithThread(
            workspace.slug,
            thread.slug,
            TEST_BRIEF,
            (chunk) => {
              try {
                chunkCount++;
                // Debug: log first few chunks
                if (chunkCount <= 2) {
                  console.log(`\n  [Chunk ${chunkCount}] ${chunk.substring(0, 100)}`);
                }
                
                const jsonStr = chunk.replace(/^data:\s*/, '');
                const data = JSON.parse(jsonStr);
                
                if (data.textResponse) {
                  fullResponse += data.textResponse;
                  if (chunkCount % 50 === 0) {
                    process.stdout.write('.');
                  }
                }
              } catch (e) {
                // Ignore parse errors
              }
            }
          ).then(() => {
            resolve();
          }).catch((err) => {
            reject(err);
          });
        }),
        180000,
        `Generate SOW (${modelConfig.name})`
      );
    } finally {
      clearInterval(progressInterval);
    }
    
    const duration = Date.now() - startTime;
    console.log(''); // New line after dots
    
    results.generatedChars = fullResponse.length;
    results.generationTimeMs = duration;
    
    log(`SOW generated: ${fullResponse.length} chars in ${Math.round(duration / 1000)}s`, 'success');
    
    if (!fullResponse || fullResponse.length === 0) {
      throw new Error('AI returned empty response');
    }

    // --- SAVE SOW TO DATABASE ---
    log('Saving SOW to database...', 'step');
    
    const titleMatch = fullResponse.match(/#{1,2}\s*(.+)/);
    const sowTitle = titleMatch ? titleMatch[1].trim() : `SOW - ${modelConfig.name}`;
    
    const createSOWRes = await withTimeout(
      fetch(`${PROD_API_URL}/api/sow/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: sowTitle,
          client_name: `Test Client - ${modelConfig.name}`,
          workspace_slug: workspace.slug,
          content: fullResponse,
          status: 'draft',
          thread_slug: thread.slug,
          model_tested: modelConfig.model
        })
      }),
      15000,
      `Save SOW (${modelConfig.name})`
    );
    
    if (!createSOWRes.ok) {
      throw new Error(`Failed to save SOW: ${createSOWRes.status}`);
    }
    
    const sowData = await createSOWRes.json();
    sowId = sowData.sow?.id || sowData.id;
    results.sowId = sowId;
    
    log(`SOW saved: ID=${sowId}`, 'success');

    // --- VALIDATE SAM'S REQUIREMENTS ---
    log('Validating Sam\'s requirements...', 'step');
    
    // Check for +GST suffix
    results.hasGSTSuffix = /\+\s*GST/i.test(fullResponse);
    log(`GST Suffix: ${results.hasGSTSuffix ? '✅' : '❌'}`, results.hasGSTSuffix ? 'success' : 'error');
    
    // Check for JSON pricing table
    results.hasJSONTable = /```json|suggestedRoles/i.test(fullResponse);
    log(`JSON Pricing Table: ${results.hasJSONTable ? '✅' : '❌'}`, results.hasJSONTable ? 'success' : 'error');
    
    // Check for closing phrase
    results.hasClosingPhrase = /This concludes the Scope of Work/i.test(fullResponse);
    log(`Closing Phrase: ${results.hasClosingPhrase ? '✅' : '❌'}`, results.hasClosingPhrase ? 'success' : 'error');
    
    // Check for + prefix bullets
    results.hasPlusBullets = /\n\s*\+\s+/m.test(fullResponse);
    log(`+ Prefix Bullets: ${results.hasPlusBullets ? '✅' : '❌'}`, results.hasPlusBullets ? 'success' : 'error');
    
    // Check for round numbers ($X5k, $X0k format or 250/300 hours)
    results.hasRoundNumbers = /\$\d+(0|5)k|\b(200|250|300|350|400)\s*hours?\b/i.test(fullResponse);
    log(`Round Numbers: ${results.hasRoundNumbers ? '✅' : '❌'}`, results.hasRoundNumbers ? 'success' : 'error');
    
    // Check for Account Management at bottom (appears later in document)
    const acctMgmtMatches = [...fullResponse.matchAll(/Account Management|Account Manager/gi)];
    const lastAcctMgmtIndex = acctMgmtMatches.length > 0 ? fullResponse.lastIndexOf(acctMgmtMatches[acctMgmtMatches.length - 1][0]) : -1;
    const closingPhraseIndex = fullResponse.indexOf('This concludes');
    results.hasAccountMgmtBottom = lastAcctMgmtIndex > 0 && (closingPhraseIndex < 0 || lastAcctMgmtIndex > closingPhraseIndex - 1000);
    log(`Account Mgmt Bottom: ${results.hasAccountMgmtBottom ? '✅' : '❌'}`, results.hasAccountMgmtBottom ? 'success' : 'error');
    
    // Check for granular roles (specific role names like "Producer Email", "Specialist Design", etc.)
    results.hasGranularRoles = /Producer|Specialist|Senior|Junior|Head of|Director/i.test(fullResponse);
    log(`Granular Roles: ${results.hasGranularRoles ? '✅' : '❌'}`, results.hasGranularRoles ? 'success' : 'error');
    
    // Calculate score
    results.requirementsScore = [
      results.hasGSTSuffix,
      results.hasJSONTable,
      results.hasClosingPhrase,
      results.hasPlusBullets,
      results.hasRoundNumbers,
      results.hasAccountMgmtBottom,
      results.hasGranularRoles
    ].filter(Boolean).length;

    // --- EMBED IN WORKSPACES ---
    log('Embedding SOW in workspaces...', 'step');
    
    // Client workspace
    try {
      const clientEmbed = await withTimeout(
        fetch(`${PROD_API_URL}/api/embed`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspace_slug: workspace.slug,
            document_name: sowTitle,
            content: fullResponse
          })
        }),
        20000,
        `Embed Client (${modelConfig.name})`
      );
      
      if (clientEmbed.ok) {
        log(`Embedded in client workspace: ${workspace.slug}`, 'success');
      } else {
        log(`⚠️ Client embed failed: ${clientEmbed.status}`, 'error');
      }
    } catch (e) {
      log(`⚠️ Client embed error: ${e.message}`, 'error');
    }
    
    // Master dashboard
    try {
      const masterEmbed = await withTimeout(
        fetch(`${PROD_API_URL}/api/embed`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspace_slug: 'sow-master-dashboard',
            document_name: `${sowTitle} (${modelConfig.name})`,
            content: fullResponse
          })
        }),
        20000,
        `Embed Master (${modelConfig.name})`
      );
      
      if (masterEmbed.ok) {
        log('Embedded in master dashboard', 'success');
      } else {
        log(`⚠️ Master embed failed: ${masterEmbed.status}`, 'error');
      }
    } catch (e) {
      log(`⚠️ Master embed error: ${e.message}`, 'error');
    }

    log(`\n✅ Test completed successfully for ${modelConfig.name}`, 'success');
    return results;

  } catch (err) {
    log(`❌ Test FAILED for ${modelConfig.name}: ${err.message}`, 'error');
    results.errors.push(err.message);
    return results;
  }
}

async function main() {
  console.log('\n╔═══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                     TEST 3 LLM MODELS - SAME PROMPT                          ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════════════╝\n');
  console.log(`Prompt: "${TEST_BRIEF}"\n`);

  const allResults = [];

  // Test each model
  for (let i = 0; i < MODELS.length; i++) {
    const result = await testModel(MODELS[i], i + 1);
    allResults.push(result);
    
    // Wait between tests to avoid rate limiting
    if (i < MODELS.length - 1) {
      console.log('\n⏳ Waiting 30 seconds before next model...');
      await new Promise(resolve => setTimeout(resolve, 30000));
    }
  }

  // --- COMPARISON REPORT ---
  console.log(`\n${'='.repeat(80)}`);
  console.log('📊 COMPARISON REPORT');
  console.log(`${'='.repeat(80)}\n`);

  console.log('Model Comparison:');
  console.log('─'.repeat(100));
  console.log(
    'Model'.padEnd(35) +
    'Chars'.padEnd(10) +
    'Time(s)'.padEnd(10) +
    'Score'.padEnd(12) +
    'Status'
  );
  console.log('─'.repeat(100));

  // Sort by score (highest first)
  const sortedResults = [...allResults].sort((a, b) => b.requirementsScore - a.requirementsScore);

  for (const result of sortedResults) {
    const scoreStr = `${result.requirementsScore}/${result.maxScore}`;
    const scoreBar = '█'.repeat(result.requirementsScore) + '░'.repeat(result.maxScore - result.requirementsScore);
    const status = result.errors.length === 0 ? '✅ PASS' : '❌ FAIL';

    console.log(
      result.model.substring(0, 34).padEnd(35) +
      result.generatedChars.toString().padEnd(10) +
      (result.generationTimeMs / 1000).toFixed(1).padEnd(10) +
      (`${scoreBar} ${scoreStr}`).padEnd(12) +
      status
    );
  }
  console.log('─'.repeat(100));
  console.log('\nRequirements Legend: 1=GST | 2=JSON | 3=Closing | 4=Bullets | 5=RoundNum | 6=AcctMgmtBottom | 7=GranularRoles\n');

  // Detailed breakdown
  console.log('Detailed Requirements Breakdown:');
  console.log('─'.repeat(100));
  
  for (const result of sortedResults) {
    console.log(`\n${result.model} (${result.provider}/${result.modelId})`);
    console.log('  Requirements:');
    console.log(`    ✓ GST Suffix............. ${result.hasGSTSuffix ? '✅' : '❌'}`);
    console.log(`    ✓ JSON Table............ ${result.hasJSONTable ? '✅' : '❌'}`);
    console.log(`    ✓ Closing Phrase........ ${result.hasClosingPhrase ? '✅' : '❌'}`);
    console.log(`    ✓ + Prefix Bullets...... ${result.hasPlusBullets ? '✅' : '❌'}`);
    console.log(`    ✓ Round Numbers......... ${result.hasRoundNumbers ? '✅' : '❌'}`);
    console.log(`    ✓ Account Mgmt Bottom... ${result.hasAccountMgmtBottom ? '✅' : '❌'}`);
    console.log(`    ✓ Granular Roles........ ${result.hasGranularRoles ? '✅' : '❌'}`);
    console.log(`  Score: ${result.requirementsScore}/${result.maxScore} | Chars: ${result.generatedChars} | Time: ${(result.generationTimeMs / 1000).toFixed(1)}s`);
    if (result.errors.length > 0) {
      console.log(`  ❌ Errors: ${result.errors.join(', ')}`);
    }
  }
  console.log('─'.repeat(100));

  // Rankings
  console.log('\n🏆 RANKINGS BY REQUIREMENTS SCORE:\n');
  
  for (let i = 0; i < sortedResults.length; i++) {
    const result = sortedResults[i];
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '  ';
    const recommendation = result.requirementsScore === result.maxScore 
      ? '⭐ RECOMMENDED FOR PRODUCTION' 
      : result.requirementsScore >= 5 
      ? '✅ Good choice'
      : result.requirementsScore >= 3
      ? '⚠️ Partial match'
      : '❌ Not recommended';
    
    console.log(`${medal} #${i + 1}: ${result.model}`);
    console.log(`   Score: ${result.requirementsScore}/${result.maxScore} | ${recommendation}`);
    if (result.sowId) {
      console.log(`   SOW ID: ${result.sowId}`);
    }
  }

  console.log(`\n🎉 ALL TESTS COMPLETED!\n`);
  
  // Best performer
  const bestScore = Math.max(...allResults.map(r => r.requirementsScore));
  const bestModels = allResults.filter(r => r.requirementsScore === bestScore);
  
  if (bestScore === 7) {
    console.log(`✨ PERFECT SCORE (7/7)! 🎯\n`);
    for (const model of bestModels) {
      console.log(`   🏆 ${model.model} - PRODUCTION READY`);
      console.log(`      API: ${model.provider}/${model.modelId}`);
      console.log(`      SOW ID: ${model.sowId}`);
    }
  } else if (bestScore >= 5) {
    console.log(`✅ BEST PERFORMERS (${bestScore}/7 requirements met)\n`);
    for (const model of bestModels) {
      console.log(`   ${model.model} - Good match for production`);
      console.log(`      API: ${model.provider}/${model.modelId}`);
      console.log(`      Missing: ${['GST', 'JSON', 'Closing', 'Bullets', 'RoundNum', 'AcctMgmt', 'GranularRoles']
        .map((req, i) => [model.hasGSTSuffix, model.hasJSONTable, model.hasClosingPhrase, model.hasPlusBullets, model.hasRoundNumbers, model.hasAccountMgmtBottom, model.hasGranularRoles][i] ? null : req)
        .filter(Boolean)
        .join(', ')}`);
    }
  }
  
  console.log('\n📊 All SOW Database Links:');
  for (const result of allResults) {
    if (result.sowId) {
      const score = `${result.requirementsScore}/${result.maxScore}`;
      console.log(`  [${score}] ${result.model}: https://sow.qandu.me/api/sow/${result.sowId}`);
    } else {
      console.log(`  [FAILED] ${result.model}: Generation failed`);
    }
  }
  console.log('');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
