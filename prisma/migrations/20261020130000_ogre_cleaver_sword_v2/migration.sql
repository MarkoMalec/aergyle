-- Keep the established item template in sync with the redesigned v2 sprite.
-- Item instances refer to this template, so their inventory ownership is preserved.
UPDATE `Item`
SET
  `itemType` = 'SWORD',
  `sprite` = '/assets/items/weapons/ogre-cleaver-atlas-v2.png'
WHERE `name` = 'Ogre Cleaver';
