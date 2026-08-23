import crypto from 'crypto';

export async function seedKnowledgeBase(dataLake) {
  // Check if already seeded to make it idempotent
  const existingCategories = await dataLake.productCategories.count();
  if (existingCategories > 0) return;

  const categories = [
    { id: 'cat_flour', name: 'Flour & Grains' },
    { id: 'cat_rice', name: 'Rice' },
    { id: 'cat_pulses', name: 'Pulses & Dal' },
    { id: 'cat_oil', name: 'Oil & Ghee' },
    { id: 'cat_spices', name: 'Spices & Masala' },
    { id: 'cat_salt_sugar', name: 'Salt, Sugar & Sweeteners' },
    { id: 'cat_biscuits', name: 'Biscuits' },
    { id: 'cat_snacks', name: 'Snacks & Namkeen' },
    { id: 'cat_noodles', name: 'Noodles & Instant Food' },
    { id: 'cat_tea_coffee', name: 'Tea & Coffee' },
    { id: 'cat_dairy', name: 'Milk & Dairy' },
    { id: 'cat_bakery', name: 'Bread & Bakery' },
    { id: 'cat_beverages', name: 'Beverages' },
    { id: 'cat_personal_care', name: 'Personal Care' },
    { id: 'cat_home_cleaning', name: 'Home Cleaning' },
    { id: 'cat_paper', name: 'Paper & Household' },
    { id: 'cat_stationery', name: 'Stationery' },
    { id: 'cat_batteries', name: 'Batteries & Electrical' },
    { id: 'cat_baby', name: 'Baby Products' }
  ];

  await dataLake.productCategories.bulkPut(categories);

  const families = [
    // Flour
    { id: 'fam_atta', categoryId: 'cat_flour', name: 'Atta / Wheat Flour' },
    { id: 'fam_maida', categoryId: 'cat_flour', name: 'Maida' },
    { id: 'fam_besan', categoryId: 'cat_flour', name: 'Besan / Gram Flour' },
    { id: 'fam_sooji', categoryId: 'cat_flour', name: 'Sooji / Rava' },
    
    // Rice
    { id: 'fam_basmati', categoryId: 'cat_rice', name: 'Basmati Rice' },
    { id: 'fam_rice', categoryId: 'cat_rice', name: 'Rice' },
    
    // Cleaning
    { id: 'fam_laundry_detergent', categoryId: 'cat_home_cleaning', name: 'Laundry Detergent' },
    { id: 'fam_dishwash', categoryId: 'cat_home_cleaning', name: 'Dishwash' },
    { id: 'fam_floor_cleaner', categoryId: 'cat_home_cleaning', name: 'Floor Cleaner' },
    
    // Personal Care
    { id: 'fam_handwash', categoryId: 'cat_personal_care', name: 'Handwash' },
    { id: 'fam_bath_soap', categoryId: 'cat_personal_care', name: 'Bath Soap' },
    { id: 'fam_shampoo', categoryId: 'cat_personal_care', name: 'Shampoo' },
    
    // Biscuits
    { id: 'fam_glucose_biscuit', categoryId: 'cat_biscuits', name: 'Glucose Biscuits' },
    { id: 'fam_marie', categoryId: 'cat_biscuits', name: 'Marie' },
    
    // Noodles
    { id: 'fam_instant_noodles', categoryId: 'cat_noodles', name: 'Instant Noodles' },
    
    // Snacks
    { id: 'fam_chips', categoryId: 'cat_snacks', name: 'Chips' },
    
    // Oil
    { id: 'fam_mustard_oil', categoryId: 'cat_oil', name: 'Mustard Oil' },
    { id: 'fam_sunflower_oil', categoryId: 'cat_oil', name: 'Sunflower Oil' },
    { id: 'fam_ghee', categoryId: 'cat_oil', name: 'Ghee' }
  ];

  await dataLake.productFamilies.bulkPut(families);

  const brands = [
    { id: 'br_ashirvaad', name: 'Aashirvaad', categoryIds: ['cat_flour', 'cat_salt_sugar', 'cat_spices'] },
    { id: 'br_surf_excel', name: 'Surf Excel', categoryIds: ['cat_home_cleaning'] },
    { id: 'br_ariel', name: 'Ariel', categoryIds: ['cat_home_cleaning'] },
    { id: 'br_tide', name: 'Tide', categoryIds: ['cat_home_cleaning'] },
    { id: 'br_rin', name: 'Rin', categoryIds: ['cat_home_cleaning'] },
    { id: 'br_dettol', name: 'Dettol', categoryIds: ['cat_personal_care', 'cat_home_cleaning'] },
    { id: 'br_lifebuoy', name: 'Lifebuoy', categoryIds: ['cat_personal_care'] },
    { id: 'br_parle', name: 'Parle', categoryIds: ['cat_biscuits'] },
    { id: 'br_maggi', name: 'Maggi', categoryIds: ['cat_noodles'] },
    { id: 'br_fortune', name: 'Fortune', categoryIds: ['cat_oil', 'cat_rice'] },
    { id: 'br_lays', name: 'Lay\'s', categoryIds: ['cat_snacks'] },
    { id: 'br_kurkure', name: 'Kurkure', categoryIds: ['cat_snacks'] },
    { id: 'br_bikaji', name: 'Bikaji', categoryIds: ['cat_snacks'] }
  ];

  await dataLake.brands.bulkPut(brands);

  const aliases = [
    // Categories/Families
    { id: crypto.randomUUID(), alias: 'atta', normalizedAlias: 'atta', targetType: 'FAMILY', targetId: 'fam_atta', confidence: 'EXACT', source: 'SYSTEM_SEED' },
    { id: crypto.randomUUID(), alias: 'ata', normalizedAlias: 'ata', targetType: 'FAMILY', targetId: 'fam_atta', confidence: 'EXACT', source: 'SYSTEM_SEED' },
    { id: crypto.randomUUID(), alias: 'aata', normalizedAlias: 'aata', targetType: 'FAMILY', targetId: 'fam_atta', confidence: 'EXACT', source: 'SYSTEM_SEED' },
    { id: crypto.randomUUID(), alias: 'wheat flour', normalizedAlias: 'wheat flour', targetType: 'FAMILY', targetId: 'fam_atta', confidence: 'EXACT', source: 'SYSTEM_SEED' },
    
    { id: crypto.randomUUID(), alias: 'surf', normalizedAlias: 'surf', targetType: 'FAMILY', targetId: 'fam_laundry_detergent', confidence: 'EXACT', source: 'SYSTEM_SEED' },
    { id: crypto.randomUUID(), alias: 'washing powder', normalizedAlias: 'washing powder', targetType: 'FAMILY', targetId: 'fam_laundry_detergent', confidence: 'EXACT', source: 'SYSTEM_SEED' },
    { id: crypto.randomUUID(), alias: 'laundry detergent', normalizedAlias: 'laundry detergent', targetType: 'FAMILY', targetId: 'fam_laundry_detergent', confidence: 'EXACT', source: 'SYSTEM_SEED' },
    
    { id: crypto.randomUUID(), alias: 'handwash', normalizedAlias: 'handwash', targetType: 'FAMILY', targetId: 'fam_handwash', confidence: 'EXACT', source: 'SYSTEM_SEED' },
    { id: crypto.randomUUID(), alias: 'hand wash', normalizedAlias: 'hand wash', targetType: 'FAMILY', targetId: 'fam_handwash', confidence: 'EXACT', source: 'SYSTEM_SEED' },
    
    // Snacks Aliases (For Acceptance Tests)
    { id: crypto.randomUUID(), alias: 'lays chips', normalizedAlias: 'lays chips', targetType: 'FAMILY', targetId: 'fam_chips', confidence: 'EXACT', source: 'SYSTEM_SEED' },
    { id: crypto.randomUUID(), alias: 'lays', normalizedAlias: 'lays', targetType: 'FAMILY', targetId: 'fam_chips', confidence: 'EXACT', source: 'SYSTEM_SEED' },
    { id: crypto.randomUUID(), alias: 'lay\'s', normalizedAlias: 'lay\'s', targetType: 'FAMILY', targetId: 'fam_chips', confidence: 'EXACT', source: 'SYSTEM_SEED' },
    { id: crypto.randomUUID(), alias: 'lay\'s chips', normalizedAlias: 'lay\'s chips', targetType: 'FAMILY', targetId: 'fam_chips', confidence: 'EXACT', source: 'SYSTEM_SEED' },
    
    // Brands
    { id: crypto.randomUUID(), alias: 'ashirvad', normalizedAlias: 'ashirvad', targetType: 'BRAND', targetId: 'br_ashirvaad', confidence: 'EXACT', source: 'SYSTEM_SEED' },
    { id: crypto.randomUUID(), alias: 'ashirwad', normalizedAlias: 'ashirwad', targetType: 'BRAND', targetId: 'br_ashirvaad', confidence: 'EXACT', source: 'SYSTEM_SEED' },
    { id: crypto.randomUUID(), alias: 'ashirvaad', normalizedAlias: 'ashirvaad', targetType: 'BRAND', targetId: 'br_ashirvaad', confidence: 'EXACT', source: 'SYSTEM_SEED' },
    { id: crypto.randomUUID(), alias: 'aashirvaad', normalizedAlias: 'aashirvaad', targetType: 'BRAND', targetId: 'br_ashirvaad', confidence: 'EXACT', source: 'SYSTEM_SEED' },
    
    { id: crypto.randomUUID(), alias: 'surf excel', normalizedAlias: 'surf excel', targetType: 'BRAND', targetId: 'br_surf_excel', confidence: 'EXACT', source: 'SYSTEM_SEED' },
    { id: crypto.randomUUID(), alias: 'surf exel', normalizedAlias: 'surf exel', targetType: 'BRAND', targetId: 'br_surf_excel', confidence: 'EXACT', source: 'SYSTEM_SEED' },
  ];

  await dataLake.productAliases.bulkPut(aliases);
}
