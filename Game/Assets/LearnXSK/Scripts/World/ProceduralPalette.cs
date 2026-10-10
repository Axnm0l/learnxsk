using System;
using UnityEngine;

namespace LearnXSK.World
{
    /// <summary>
    /// Deterministic, organic palette system for LearnXSK: The Blocklands.
    /// Eliminates generic neon/dashboard colors in favor of classic earthy voxel tones.
    /// </summary>
    public static class ProceduralPalette
    {
        // Core Hues
        public static readonly Color GrassGreenBase   = new Color(0.35f, 0.62f, 0.22f); // #599E38 - Lush pasture green
        public static readonly Color GrassGreenHighlight = new Color(0.46f, 0.74f, 0.28f); // #76BD47 - Sunlit tip
        public static readonly Color GrassGreenShadow   = new Color(0.24f, 0.46f, 0.16f); // #3D7529 - Cool shaded blade
        
        public static readonly Color SoilBrownDark     = new Color(0.34f, 0.23f, 0.15f); // #573B26 - Rich dark loam
        public static readonly Color SoilBrownMedium   = new Color(0.44f, 0.31f, 0.20f); // #704F33 - Natural dirt
        public static readonly Color SoilBrownLight    = new Color(0.53f, 0.38f, 0.26f); // #876142 - Dry crumbly earth
        
        public static readonly Color PathGravelLight   = new Color(0.66f, 0.58f, 0.45f); // #A89473 - Packed sand/dirt
        public static readonly Color PathGravelDark    = new Color(0.54f, 0.46f, 0.34f); // #8A7557 - Weathered trail
        
        public static readonly Color WoodTrunkDark     = new Color(0.28f, 0.18f, 0.12f); // #472E1E - Bark shadow
        public static readonly Color WoodTrunkLight    = new Color(0.42f, 0.28f, 0.18f); // #6B472E - Oak bark
        public static readonly Color WoodPlankLight    = new Color(0.68f, 0.50f, 0.30f); // #AE804D - Cut timber
        public static readonly Color WoodPlankDark     = new Color(0.52f, 0.36f, 0.20f); // #855C33 - Plank border
        
        public static readonly Color LeafGreenDeep     = new Color(0.18f, 0.40f, 0.16f); // #2E6629 - Pine/Oak core
        public static readonly Color LeafGreenLight    = new Color(0.29f, 0.55f, 0.22f); // #4A8C38 - Outer foliage
        
        public static readonly Color StoneGrayDark     = new Color(0.38f, 0.38f, 0.40f); // #616166 - Cobblestone
        public static readonly Color StoneGrayLight    = new Color(0.55f, 0.55f, 0.58f); // #8C8C94 - Smooth rock
        
        public static readonly Color FlowerRed         = new Color(0.85f, 0.22f, 0.22f); // Wild poppy
        public static readonly Color FlowerYellow      = new Color(0.95f, 0.82f, 0.24f); // Dandelion
        public static readonly Color FlowerBlue        = new Color(0.28f, 0.52f, 0.85f); // Cornflower
        
        public static readonly Color TerminalCasing    = new Color(0.20f, 0.24f, 0.28f); // Rugged field terminal metal
        public static readonly Color TerminalScreenOn  = new Color(0.12f, 0.22f, 0.15f); // Soft phosphor CRT background
        public static readonly Color TerminalPhosphor  = new Color(0.35f, 0.90f, 0.45f); // Vintage phosphor text green
        public static readonly Color TerminalLedAlert  = new Color(0.95f, 0.60f, 0.15f); // Status amber

        public static readonly Color AdventurerTunic   = new Color(0.22f, 0.45f, 0.65f); // Indigo cloth
        public static readonly Color AdventurerLeather = new Color(0.48f, 0.30f, 0.16f); // Boots & belt
        public static readonly Color AdventurerSkin    = new Color(0.88f, 0.72f, 0.58f); // Warm skin tone
        public static readonly Color AdventurerHair    = new Color(0.25f, 0.18f, 0.12f); // Dark hair

        /// <summary>
        /// Generates a coordinate-based deterministic pseudo-random float [0, 1].
        /// </summary>
        public static float Hash2D(int x, int y, int seed = 1337)
        {
            int h = seed + x * 374761393 + y * 668265263;
            h = (h ^ (h >> 13)) * 1274126177;
            h = h ^ (h >> 16);
            return (h & 0x7FFFFFFF) / (float)0x7FFFFFFF;
        }

        /// <summary>
        /// Returns subtle deterministic color variation for grass tiles.
        /// </summary>
        public static Color GetVariedGrass(int x, int y, int seed)
        {
            float noise = Hash2D(x, y, seed);
            if (noise < 0.25f) return GrassGreenShadow;
            if (noise > 0.75f) return GrassGreenHighlight;
            return Color.Lerp(GrassGreenBase, GrassGreenHighlight, noise * 0.5f);
        }
    }
}
