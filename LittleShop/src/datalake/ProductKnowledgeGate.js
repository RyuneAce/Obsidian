import { GoogleGenerativeAI } from '@google/generative-ai';

const AI_RESOLVER_PROMPT = `You are a product normalization AI for a shopkeeper app. 
Analyze the raw product strings and return structured JSON representing their product identities.
Categorize the products into a Category, a canonical product name (Family), and a Brand. 
Extract any explicit pack size. Do NOT invent a brand, pack size, price, or anything else if it's missing (return explicitly null).
Use typical Indian grocery/general store terminology.

IMPORTANT RULE FOR CATEGORIES & FAMILIES:
1. Always prefer using an existing Category and Family from the provided lists if it is a reasonable fit (including typo corrections).
2. Only invent a NEW Category or Family if absolutely no existing one is appropriate.
3. Keep categories broad (e.g. Snacks & Namkeen, Cleaning, Grocery).
4. NEVER invent quantity, price, pack size, or any other product details if they are missing from the raw input.

CRITICAL IDENTITY-PRESERVATION RULE:
1. Never replace, normalize, or overwrite the user's specific product name (proposedCanonicalName) merely because it belongs to an existing Product Family.
2. Product Variant Name and Product Family are separate concepts.
3. If the input is "Arhar Dal 5kg", the proposedCanonicalName MUST remain "Arhar Dal 5kg" even if you assign it to the Product Family "Toor Dal".
4. ONLY resolve/correct the product name itself when there is strong evidence of a typo (e.g., 'Wurf Excel' -> 'Surf Excel').
5. Do NOT merge or rename distinct variants into their family name. Preserve the exact variant identity from the input.

Schema per item:
{
  "inputName": "String (Original Input)",
  "proposedCanonicalName": "String (Specific Product Variant e.g. Ashirvaad Atta 5kg)",
  "proposedFamily": "String (Generic Aggregation Bucket e.g. Atta / Wheat Flour)",
  "proposedCategory": "String (e.g. Flour) or UNKNOWN",
  "brand": "String or null",
  "packSize": "String or null",
  "confidence": "Number between 0 and 1",
  "needsUserConfirmation": true,
  "reason": "String explaining reasoning"
}

If you receive an array of inputs, return an array of these JSON objects.
Respond ONLY with valid JSON. NO markdown.`;

const AI_NORMALIZATION_PROMPT = `You are STAGE 1 (NORMALIZATION) of a product processing pipeline.
Your ONLY job is to normalize typos, spelling mistakes, phonetic misspellings, capitalization, and spacing in the raw product inputs.

CRITICAL RULES:
1. Do NOT invent a category.
2. Do NOT invent a product family.
3. Do NOT merge distinct products into their family names.
4. Preserve the exact product identity, quantities, and units.
5. If you don't know the product or there are no obvious typos, leave the name exactly as is, but fix capitalization.

Example: "ashirvad aata 5kg" -> "Ashirvaad Atta 5kg"
Example: "arhar daal 5kg" -> "Arhar Dal 5kg" (NOT Toor Dal)
Example: "surf exel 2kg" -> "Surf Excel 2kg"

Schema per item:
{
  "inputName": "String (Original Input)",
  "normalizedName": "String (Corrected spelling, preserved identity)"
}

If you receive an array of inputs, return an array of these JSON objects.
Respond ONLY with valid JSON. NO markdown.`;

export class ProductKnowledgeGate {
  constructor(dataLake, apiKey) {
    this.dataLake = dataLake;
    this.apiKey = apiKey;
  }

  normalizeString(str) {
    if (!str) return '';
    return str
      .toLowerCase()
      .replace(/[^\w\s\.]/g, ' ') // replace punctuation with space
      .replace(/\s+/g, ' ') // collapse spaces
      .trim();
  }

  extractPackSize(str) {
    const packRegex = /([0-9]+(?:\.[0-9]+)?)\s*(kg|g|mg|l|ml|litre|litres|pc|pcs|pack|packs)/i;
    const match = str.match(packRegex);
    if (match) {
      return {
        textMatch: match[0],
        value: parseFloat(match[1]),
        unit: match[2].toLowerCase()
      };
    }
    return null;
  }

  isCategoryEquivalent(cat1, cat2) {
      if (!cat1 || !cat2) return false;
      const norm1 = cat1.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
      const norm2 = cat2.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
      if (norm1 === norm2) return true;
      
      const excludeWords = ['and', 'or', 'of', 'items', 'products'];
      const w1 = norm1.split(' ').map(w => w.endsWith('s') ? w.slice(0, -1) : w).filter(w => !excludeWords.includes(w) && w.length > 0);
      const w2 = norm2.split(' ').map(w => w.endsWith('s') ? w.slice(0, -1) : w).filter(w => !excludeWords.includes(w) && w.length > 0);
      
      if (w1.length === 0 || w2.length === 0) return false;
      
      const s1 = [...w1].sort().join(' ');
      const s2 = [...w2].sort().join(' ');
      if (s1 === s2) return true;
      
      const intersection = w1.filter(x => w2.includes(x));
      if (intersection.length > 0) {
          if (intersection.length === w1.length || intersection.length === w2.length) {
              return true; 
          }
      }
      return false;
  }

  async searchProducts(query) {
    const normalized = this.normalizeString(query);
    if (!normalized) return [];

    const aliases = await this.dataLake.productAliases.toArray();
    const families = await this.dataLake.productFamilies.toArray();
    
    const results = [];
    
    for (const a of aliases) {
      if (a.normalizedAlias.includes(normalized)) {
        if (a.targetType === 'FAMILY') {
          const family = families.find(f => f.id === a.targetId);
          if (family && !results.some(r => r.id === family.id)) {
             results.push(family);
          }
        }
      }
    }
    
    for (const f of families) {
      if (f.name.toLowerCase().includes(normalized) && !results.some(r => r.id === f.id)) {
        results.push(f);
      }
    }

    return results;
  }

  async resolveProduct(rawName) {
    const normalized = this.normalizeString(rawName);
    const packSizeExtract = this.extractPackSize(normalized);
    
    let textToMatch = normalized;
    if (packSizeExtract) {
      textToMatch = textToMatch.replace(packSizeExtract.textMatch, '').trim();
    }

    const aliases = await this.dataLake.productAliases.toArray();
    
    let matchedFamilyId = null;
    let matchedBrandId = null;
    let matchedProductId = null;

    const exactAlias = aliases.find(a => a.normalizedAlias === textToMatch);
    if (exactAlias) {
      if (exactAlias.targetType === 'PRODUCT') matchedProductId = exactAlias.targetId;
      if (exactAlias.targetType === 'FAMILY') matchedFamilyId = exactAlias.targetId;
      if (exactAlias.targetType === 'BRAND') matchedBrandId = exactAlias.targetId;
    }

    if (!matchedProductId && (!matchedFamilyId || !matchedBrandId)) {
       for (const alias of aliases) {
         if (textToMatch.includes(alias.normalizedAlias)) {
            if (alias.targetType === 'PRODUCT' && !matchedProductId) matchedProductId = alias.targetId;
            if (alias.targetType === 'FAMILY' && !matchedFamilyId) matchedFamilyId = alias.targetId;
            if (alias.targetType === 'BRAND' && !matchedBrandId) matchedBrandId = alias.targetId;
         }
       }
    }

    if (matchedProductId || matchedFamilyId || matchedBrandId) {
      let canonical = matchedProductId ? await this.dataLake.canonicalProducts.get(matchedProductId) : null;
      if (canonical && canonical.status === 'MERGED' && canonical.canonicalTargetId) {
          matchedProductId = canonical.canonicalTargetId;
          canonical = await this.dataLake.canonicalProducts.get(matchedProductId);
      }
      
      // If we matched a product directly, inherit its family
      if (canonical && !matchedFamilyId) {
          matchedFamilyId = canonical.familyId;
      }
      
      let family = matchedFamilyId ? await this.dataLake.productFamilies.get(matchedFamilyId) : null;
      if (family && family.status === 'MERGED' && family.canonicalTargetId) {
          matchedFamilyId = family.canonicalTargetId;
          family = await this.dataLake.productFamilies.get(matchedFamilyId);
      }

      let brand = matchedBrandId ? await this.dataLake.brands.get(matchedBrandId) : null;
      let category = family ? await this.dataLake.productCategories.get(family.categoryId) : null;
      if (category && category.status === 'MERGED' && category.canonicalTargetId) {
          category = await this.dataLake.productCategories.get(category.canonicalTargetId);
      }
      
      // If we only matched family/brand but no canonical yet, try to find a matching product by name
      if (!canonical && matchedFamilyId) {
          const canonicals = await this.dataLake.canonicalProducts.where('familyId').equals(matchedFamilyId).toArray();
          canonical = canonicals.find(c => c.name.toLowerCase() === textToMatch.toLowerCase()) || null;
      }

      return {
        rawInput: rawName,
        normalizedText: textToMatch,
        categoryId: category ? category.id : null,
        categoryName: category ? category.name : null,
        familyId: family ? family.id : null,
        familyName: family ? family.name : null,
        brandId: brand ? brand.id : null,
        brandName: brand ? brand.name : null,
        productId: canonical ? canonical.id : null, 
        canonicalName: canonical ? canonical.name : null,
        variant: null,
        packSize: packSizeExtract ? `${packSizeExtract.value}${packSizeExtract.unit}` : null,
        confidence: 1.0,
        resolutionMethod: 'LOCAL_MATCH',
        needsReview: false,
        needsUserConfirmation: false
      };
    }

    return null; // Signals it requires AI fallback
  }

  async resolveSingleItem(itemRawName) {
      if (!itemRawName || itemRawName.trim() === '') {
          return { resolutionStatus: 'UNKNOWN', needsUserConfirmation: true, rawInput: itemRawName };
      }

      // 1. Exact Memory / Product Knowledge Check
      const localMatchStage1 = await this.resolveProduct(itemRawName);
      if (localMatchStage1) {
          return {
              rawInput: itemRawName,
              normalizedText: localMatchStage1.normalizedText,
              proposedCanonicalName: localMatchStage1.canonicalName || localMatchStage1.normalizedText,
              proposedFamily: localMatchStage1.familyName || localMatchStage1.canonicalName || localMatchStage1.normalizedText,
              proposedCategory: localMatchStage1.categoryName || 'UNKNOWN',
              brand: localMatchStage1.brandName,
              packSize: localMatchStage1.packSize,
              resolutionMethod: 'LOCAL_MATCH',
              resolutionSource: 'ALREADY_KNOWN',
              needsUserConfirmation: false
          };
      }

      if (!this.apiKey || !navigator.onLine) {
         return {
              rawInput: itemRawName,
              normalizedText: this.normalizeString(itemRawName),
              proposedCanonicalName: itemRawName,
              proposedFamily: 'UNKNOWN',
              proposedCategory: 'UNKNOWN',
              brand: null,
              packSize: null,
              resolutionMethod: 'AI_REQUIRED_BUT_UNAVAILABLE',
              resolutionSource: 'UNKNOWN',
              needsUserConfirmation: true
         };
      }

      try {
          const genAI = new GoogleGenerativeAI(this.apiKey);
          const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash-lite" });

          // 2. Gemini Typo / Normalization
          const stage1Result = await model.generateContent([AI_NORMALIZATION_PROMPT, `Products:\n${JSON.stringify([itemRawName])}`]);
          let stage1Text = stage1Result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
          let stage1Parsed = JSON.parse(stage1Text);
          if (Array.isArray(stage1Parsed)) stage1Parsed = stage1Parsed[0];
          
          const normalizedName = stage1Parsed && stage1Parsed.normalizedName ? stage1Parsed.normalizedName : itemRawName;

          // 3. Search Memory Again
          const localMatchStage2 = await this.resolveProduct(normalizedName);
          if (localMatchStage2) {
              return {
                  rawInput: itemRawName,
                  normalizedText: localMatchStage2.normalizedText,
                  proposedCanonicalName: localMatchStage2.canonicalName || localMatchStage2.normalizedText,
                  proposedFamily: localMatchStage2.familyName || localMatchStage2.canonicalName || localMatchStage2.normalizedText,
                  proposedCategory: localMatchStage2.categoryName || 'UNKNOWN',
                  brand: localMatchStage2.brandName,
                  packSize: localMatchStage2.packSize,
                  resolutionMethod: 'LOCAL_MATCH',
                  resolutionSource: 'ALREADY_KNOWN',
                  needsUserConfirmation: false
              };
          }

          // 4. Gemini Classification (Only if still not found)
          const families = await this.dataLake.productFamilies.toArray();
          const familyNames = families.map(f => f.name).join(', ');

          const categories = await this.dataLake.productCategories.toArray();
          const categoryNames = categories.map(c => c.name).join(', ');
          
          const contextPrompt = `${AI_RESOLVER_PROMPT}\n\nExisting Categories in DB: ${categoryNames || 'None'}\nExisting Families in DB: ${familyNames || 'None'}`;
          
          const result = await model.generateContent([contextPrompt, `Products:\n${JSON.stringify([normalizedName])}`]);
          let responseText = result.response.text();
          responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
          
          let aiRes = JSON.parse(responseText);
          if (Array.isArray(aiRes)) aiRes = aiRes[0];

          if (aiRes) {
              let bestCategory = aiRes.proposedCategory || 'UNKNOWN';
              if (bestCategory !== 'UNKNOWN') {
                  const existingMatch = categories.find(c => this.isCategoryEquivalent(c.name, bestCategory));
                  if (existingMatch) {
                      bestCategory = existingMatch.name;
                  }
              }

              return {
                  rawInput: itemRawName,
                  normalizedText: this.normalizeString(normalizedName),
                  proposedCanonicalName: aiRes.proposedCanonicalName || normalizedName,
                  proposedFamily: aiRes.proposedFamily || aiRes.proposedCanonicalName || normalizedName,
                  proposedCategory: bestCategory,
                  brand: aiRes.brand || null,
                  packSize: aiRes.packSize || null,
                  resolutionMethod: 'AI_FALLBACK',
                  resolutionSource: 'AI_MADE',
                  needsUserConfirmation: true
              };
          }
      } catch (e) {
          console.error("Single item resolution failed:", e);
      }

      return {
          rawInput: itemRawName,
          proposedCanonicalName: itemRawName,
          proposedFamily: 'UNKNOWN',
          proposedCategory: 'UNKNOWN',
          brand: null,
          packSize: null,
          resolutionMethod: 'AI_FAILED',
          resolutionSource: 'UNKNOWN',
          needsUserConfirmation: true
      };
  }

  async resolveBatch(items) {
      // Stage 0: Resolve locally first (Fast Path)
      const resolvedItems = [];
      const unknownItemsStage0 = [];

      for (let item of items) {
          const localMatch = await this.resolveProduct(item.rawName);
          if (localMatch) {
              resolvedItems.push({ ...item, resolution: localMatch });
          } else {
              unknownItemsStage0.push(item);
          }
      }

      if (unknownItemsStage0.length === 0) {
          return { resolvedItems, unknownItems: [] };
      }

      if (!this.apiKey || !navigator.onLine) {
         for (let item of unknownItemsStage0) {
            item.resolution = {
                rawInput: item.rawName,
                normalizedText: this.normalizeString(item.rawName),
                confidence: 0,
                resolutionMethod: 'AI_REQUIRED_BUT_UNAVAILABLE',
                needsReview: true,
                needsUserConfirmation: true,
                proposedCanonicalName: item.rawName,
                proposedFamily: 'UNKNOWN',
                proposedCategory: 'UNKNOWN',
                brand: null,
                packSize: null
            };
            resolvedItems.push(item);
         }
         return { resolvedItems, unknownItems: [] };
      }

      try {
          const genAI = new GoogleGenerativeAI(this.apiKey);
          const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash-lite" });
          
          // STAGE 1: AI Normalization
          const stage1Inputs = unknownItemsStage0.map(i => i.rawName);
          const stage1Result = await model.generateContent([AI_NORMALIZATION_PROMPT, `Products:\n${JSON.stringify(stage1Inputs)}`]);
          let stage1Text = stage1Result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
          let stage1Parsed = JSON.parse(stage1Text);
          if (!Array.isArray(stage1Parsed)) stage1Parsed = [stage1Parsed];

          const unknownItemsStage2 = [];

          // STAGE 2: Memory Lookup with Normalized Names
          for (let item of unknownItemsStage0) {
              const aiNorm = stage1Parsed.find(p => p.inputName === item.rawName);
              const normalizedName = aiNorm ? aiNorm.normalizedName : item.rawName;
              item.stage1NormalizedName = normalizedName;

              const localMatch = await this.resolveProduct(normalizedName);
              if (localMatch) {
                  resolvedItems.push({ ...item, resolution: localMatch });
              } else {
                  unknownItemsStage2.push(item);
              }
          }

          if (unknownItemsStage2.length === 0) {
              return { resolvedItems, unknownItems: [] };
          }

          // STAGE 3: Unknown Product Analysis
          const families = await this.dataLake.productFamilies.toArray();
          const familyNames = families.map(f => f.name).join(', ');

          const categories = await this.dataLake.productCategories.toArray();
          const categoryNames = categories.map(c => c.name).join(', ');
          
          const contextPrompt = `${AI_RESOLVER_PROMPT}\n\nExisting Categories in DB: ${categoryNames || 'None'}\nExisting Families in DB: ${familyNames || 'None'}`;
          const stage3Inputs = unknownItemsStage2.map(i => i.stage1NormalizedName);
          
          const result = await model.generateContent([contextPrompt, `Products:\n${JSON.stringify(stage3Inputs)}`]);
          let responseText = result.response.text();
          responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
          
          let parsed = JSON.parse(responseText);
          if (!Array.isArray(parsed)) parsed = [parsed];

          // Map Gemini results back to unknownItemsStage2
          unknownItemsStage2.forEach((item, index) => {
             const aiRes = parsed[index] || parsed.find(p => p.inputName === item.stage1NormalizedName);
             
             if (aiRes) {
                 let bestCategory = aiRes.proposedCategory || 'UNKNOWN';
                 if (bestCategory !== 'UNKNOWN') {
                     const existingMatch = categories.find(c => this.isCategoryEquivalent(c.name, bestCategory));
                     if (existingMatch) {
                         bestCategory = existingMatch.name;
                     }
                 }

                 item.resolution = {
                    rawInput: item.rawName,
                    normalizedText: this.normalizeString(item.stage1NormalizedName),
                    proposedCanonicalName: aiRes.proposedCanonicalName || item.stage1NormalizedName,
                    proposedFamily: aiRes.proposedFamily || aiRes.proposedCanonicalName || item.stage1NormalizedName,
                    proposedCategory: bestCategory,
                    brand: aiRes.brand || null,
                    packSize: aiRes.packSize || null,
                    confidence: aiRes.confidence || 0.5,
                    needsUserConfirmation: true,
                    needsReview: true,
                    reason: aiRes.reason || '',
                    resolutionMethod: 'AI_FALLBACK'
                 };
             } else {
                 item.resolution = {
                    rawInput: item.rawName,
                    proposedCanonicalName: item.stage1NormalizedName,
                    proposedFamily: 'UNKNOWN',
                    proposedCategory: 'UNKNOWN',
                    needsUserConfirmation: true,
                    needsReview: true,
                    resolutionMethod: 'AI_FAILED'
                 };
             }
             resolvedItems.push(item);
          });
      } catch (e) {
         console.error("Gemini batch resolution failed:", e);
         unknownItemsStage0.forEach(item => {
             item.resolution = {
                rawInput: item.rawName,
                proposedCanonicalName: item.stage1NormalizedName || item.rawName,
                proposedFamily: 'UNKNOWN',
                proposedCategory: 'UNKNOWN',
                needsUserConfirmation: true,
                needsReview: true,
                resolutionMethod: 'AI_FAILED',
                error: e.message
             };
             if (!resolvedItems.some(r => r.rawName === item.rawName)) {
                resolvedItems.push(item);
             }
         });
      }

      return { resolvedItems, unknownItems: [] };
  }

  getCanonicalName(resolvedData) {
     const nameToUse = resolvedData.canonicalName || resolvedData.proposedCanonicalName || resolvedData.rawInput;
     const packSuffix = resolvedData.packSize ? (typeof resolvedData.packSize === 'object' ? ` ${resolvedData.packSize.value}${resolvedData.packSize.unit}` : ` ${resolvedData.packSize}`) : '';
     return (nameToUse + packSuffix).trim();
  }

  async dispatchKnowledgeAction(action) {
      if (!action.id) action.id = crypto.randomUUID();
      if (!action.timestamp) action.timestamp = Date.now();
      
      await this.dataLake.knowledgeActions.put(action);
      
      try {
          if (action.type === 'KNOWLEDGE_MERGE') {
              if (action.entityType === 'CATEGORY') {
                  await this.dataLake.productCategories.update(action.entityId, { status: 'MERGED', canonicalTargetId: action.targetId });
              } else if (action.entityType === 'FAMILY') {
                  await this.dataLake.productFamilies.update(action.entityId, { status: 'MERGED', canonicalTargetId: action.targetId });
              } else if (action.entityType === 'PRODUCT') {
                  await this.dataLake.canonicalProducts.update(action.entityId, { status: 'MERGED', canonicalTargetId: action.targetId });
              }
          } else if (action.type === 'KNOWLEDGE_CORRECTION') {
              if (action.entityType === 'CATEGORY') {
                  await this.dataLake.productCategories.update(action.entityId, { name: action.newValue });
              } else if (action.entityType === 'FAMILY') {
                  await this.dataLake.productFamilies.update(action.entityId, { name: action.newValue });
              } else if (action.entityType === 'PRODUCT') {
                  await this.dataLake.canonicalProducts.update(action.entityId, { name: action.newValue });
              }
          } else if (action.type === 'KNOWLEDGE_DEPRECATE') {
              if (action.entityType === 'CATEGORY') await this.dataLake.productCategories.update(action.entityId, { status: 'DEPRECATED' });
              if (action.entityType === 'FAMILY') await this.dataLake.productFamilies.update(action.entityId, { status: 'DEPRECATED' });
              if (action.entityType === 'PRODUCT') await this.dataLake.canonicalProducts.update(action.entityId, { status: 'DEPRECATED' });
          } else if (action.type === 'KNOWLEDGE_ALIAS_ADD') {
              await this.dataLake.productAliases.put({
                  id: crypto.randomUUID(),
                  alias: action.newValue,
                  normalizedAlias: this.normalizeString(action.newValue),
                  targetType: action.entityType,
                  targetId: action.entityId,
                  confidence: 'USER_CONFIRMED',
                  source: action.source || 'MANUAL_EDIT'
              });
          }
      } catch (e) {
          console.error("Failed to apply knowledge action", e);
      }
  }
}
