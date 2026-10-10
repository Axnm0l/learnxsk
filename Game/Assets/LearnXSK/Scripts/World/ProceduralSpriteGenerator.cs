using System.Collections.Generic;
using UnityEngine;

namespace LearnXSK.World
{
    /// <summary>
    /// Generates crisp, original pixel-art isometric block and prop sprites at runtime in code.
    /// Strictly avoids downloaded assets and creates a cohesive classic voxel sandbox look.
    /// </summary>
    public static class ProceduralSpriteGenerator
    {
        private static readonly Dictionary<string, Sprite> _cache = new Dictionary<string, Sprite>();

        public static Sprite GetSprite(string key, System.Func<Sprite> creator)
        {
            if (_cache.TryGetValue(key, out var sprite) && sprite != null)
                return sprite;

            sprite = creator();
            _cache[key] = sprite;
            return sprite;
        }

        public static Texture2D CreateTexture(int width, int height, Color clearColor)
        {
            var tex = new Texture2D(width, height, TextureFormat.RGBA32, false)
            {
                filterMode = FilterMode.Point,
                wrapMode = TextureWrapMode.Clamp
            };
            var pixels = new Color[width * height];
            for (int i = 0; i < pixels.Length; i++) pixels[i] = clearColor;
            tex.SetPixels(pixels);
            return tex;
        }

        public static Sprite CreateSpriteFromTex(Texture2D tex, Vector2 pivot, float pixelsPerUnit = 32f)
        {
            tex.Apply();
            return Sprite.Create(tex, new Rect(0, 0, tex.width, tex.height), pivot, pixelsPerUnit);
        }

        #region Isometric Block Generator
        /// <summary>
        /// Generates an isometric voxel cube (32 wide x 32 high) with 2:1 top diamond and visible dirt sides.
        /// </summary>
        public static Sprite CreateIsometricVoxelBlock(Color topMain, Color topShadow, Color leftSide, Color rightSide, int seed = 42)
        {
            const int W = 32;
            const int H = 32;
            var tex = CreateTexture(W, H, Color.clear);

            // Diamond parameters:
            // Top diamond center at (15.5, 23.5), width 32, height 16.
            // Left facet: (0, 16) to (15, 8) to (15, 0) to (0, 8).
            // Right facet: (16, 8) to (31, 16) to (31, 8) to (16, 0).

            for (int y = 0; y < H; y++)
            {
                for (int x = 0; x < W; x++)
                {
                    // Normalized coords for diamond check:
                    // Diamond top covers y from 16 to 31.
                    // Center of diamond is (15.5, 23.5)
                    float dx = Mathf.Abs(x - 15.5f);
                    float dy = Mathf.Abs(y - 23.5f);

                    // Diamond equation: dx / 16 + dy / 8 <= 1
                    if ((dx / 16f) + (dy / 8f) <= 1.0f && y >= 16)
                    {
                        // Inside top surface
                        float noise = ProceduralPalette.Hash2D(x, y, seed);
                        Color c = Color.Lerp(topMain, topShadow, noise * 0.4f);
                        // Subtle edge highlight on top-left edge
                        if (x < 16 && (dx / 16f) + (dy / 8f) > 0.85f && y > 23)
                        {
                            c = Color.Lerp(c, Color.white, 0.15f);
                        }
                        tex.SetPixel(x, y, c);
                    }
                    else if (y < 16 && y >= 0)
                    {
                        // Sides of the block
                        // Left side: x from 0 to 15, y bounded by diamond bottom line (dy = (1 - dx/16)*8 + 16 - 16 = (1 - x/16)*8)
                        float topY = 16f - (Mathf.Abs(x - 15.5f) / 16f) * 8f;
                        if (y <= topY && y >= topY - 14f)
                        {
                            float noise = ProceduralPalette.Hash2D(x, y, seed + 99);
                            if (x <= 15)
                            {
                                // Left facet (in shadow)
                                Color sideC = Color.Lerp(leftSide, ProceduralPalette.SoilBrownDark, noise * 0.35f);
                                // Grass overhang dripping down onto soil:
                                if (topY - y < 3 + (int)(noise * 2.5f))
                                {
                                    sideC = topShadow;
                                }
                                tex.SetPixel(x, y, sideC);
                            }
                            else
                            {
                                // Right facet (receiving light)
                                Color sideC = Color.Lerp(rightSide, ProceduralPalette.SoilBrownMedium, noise * 0.3f);
                                if (topY - y < 3 + (int)(noise * 2.5f))
                                {
                                    sideC = topMain;
                                }
                                tex.SetPixel(x, y, sideC);
                            }
                        }
                    }
                }
            }

            // Pivot at bottom center (16, 8) so tiles align seamlessly
            return CreateSpriteFromTex(tex, new Vector2(0.5f, 0.25f));
        }

        public static Sprite CreateGrassBlock(int seed = 101)
        {
            return CreateIsometricVoxelBlock(
                ProceduralPalette.GrassGreenBase,
                ProceduralPalette.GrassGreenShadow,
                ProceduralPalette.SoilBrownDark,
                ProceduralPalette.SoilBrownMedium,
                seed
            );
        }

        public static Sprite CreateDirtPathBlock(int seed = 202)
        {
            return CreateIsometricVoxelBlock(
                ProceduralPalette.PathGravelLight,
                ProceduralPalette.PathGravelDark,
                ProceduralPalette.SoilBrownDark,
                ProceduralPalette.SoilBrownMedium,
                seed
            );
        }

        public static Sprite CreateStoneBlock(int seed = 303)
        {
            return CreateIsometricVoxelBlock(
                ProceduralPalette.StoneGrayLight,
                ProceduralPalette.StoneGrayDark,
                ProceduralPalette.StoneGrayDark * 0.8f,
                ProceduralPalette.StoneGrayLight * 0.9f,
                seed
            );
        }

        public static Sprite CreateWoodPlankBlock(int seed = 404)
        {
            return CreateIsometricVoxelBlock(
                ProceduralPalette.WoodPlankLight,
                ProceduralPalette.WoodPlankDark,
                ProceduralPalette.WoodPlankDark * 0.85f,
                ProceduralPalette.WoodPlankLight * 0.9f,
                seed
            );
        }
        #endregion

        #region Foliage & Nature Props
        /// <summary>
        /// Generates a blocky pine/oak tree sprite (32 wide x 48 high) with wooden trunk and voxel canopy.
        /// </summary>
        public static Sprite CreateIsometricTree(int seed = 505)
        {
            const int W = 32;
            const int H = 48;
            var tex = CreateTexture(W, H, Color.clear);

            // Trunk: centered, x: 13 to 18, y: 0 to 18
            for (int y = 0; y <= 18; y++)
            {
                for (int x = 13; x <= 18; x++)
                {
                    float noise = ProceduralPalette.Hash2D(x, y, seed);
                    Color trunkC = (x < 16) ? ProceduralPalette.WoodTrunkDark : ProceduralPalette.WoodTrunkLight;
                    trunkC = Color.Lerp(trunkC, ProceduralPalette.WoodTrunkDark, noise * 0.2f);
                    tex.SetPixel(x, y, trunkC);
                }
            }

            // Lower Canopy tier (y: 12 to 32)
            DrawCanopyCluster(tex, 16, 26, 13, 8, ProceduralPalette.LeafGreenDeep, ProceduralPalette.LeafGreenLight, seed + 1);
            // Middle Canopy tier (y: 24 to 40)
            DrawCanopyCluster(tex, 16, 35, 10, 7, ProceduralPalette.LeafGreenDeep, ProceduralPalette.LeafGreenLight, seed + 2);
            // Upper Canopy crown (y: 34 to 46)
            DrawCanopyCluster(tex, 16, 42, 6, 5, ProceduralPalette.LeafGreenLight, ProceduralPalette.GrassGreenHighlight, seed + 3);

            return CreateSpriteFromTex(tex, new Vector2(0.5f, 0.1f));
        }

        private static void DrawCanopyCluster(Texture2D tex, int cx, int cy, int rx, int ry, Color baseCol, Color lightCol, int seed)
        {
            for (int y = cy - ry; y <= cy + ry; y++)
            {
                for (int x = cx - rx; x <= cx + rx; x++)
                {
                    if (x < 0 || x >= tex.width || y < 0 || y >= tex.height) continue;
                    float dx = (x - cx) / (float)rx;
                    float dy = (y - cy) / (float)ry;
                    if (dx * dx + dy * dy <= 1.0f)
                    {
                        float noise = ProceduralPalette.Hash2D(x, y, seed);
                        // Sunlight from upper-right
                        Color c = (x > cx || y > cy) ? lightCol : baseCol;
                        c = Color.Lerp(c, baseCol, noise * 0.3f);
                        tex.SetPixel(x, y, c);
                    }
                }
            }
        }

        public static Sprite CreateGrassTuft(int seed = 606)
        {
            const int W = 16;
            const int H = 16;
            var tex = CreateTexture(W, H, Color.clear);

            // 3-4 small blades of grass
            int[] bladeX = { 4, 7, 10, 12 };
            int[] bladeH = { 7, 10, 9, 6 };
            for (int b = 0; b < bladeX.Length; b++)
            {
                int bx = bladeX[b];
                int bh = bladeH[b];
                for (int y = 0; y < bh; y++)
                {
                    float noise = ProceduralPalette.Hash2D(bx, y, seed);
                    Color c = Color.Lerp(ProceduralPalette.GrassGreenBase, ProceduralPalette.GrassGreenHighlight, y / (float)bh);
                    tex.SetPixel(bx, y, c);
                    if (y > 2 && bx + 1 < W) tex.SetPixel(bx + (b % 2 == 0 ? -1 : 1), y - 1, c * 0.9f);
                }
            }
            return CreateSpriteFromTex(tex, new Vector2(0.5f, 0.1f));
        }

        public static Sprite CreateFlower(Color petalColor, int seed = 707)
        {
            const int W = 16;
            const int H = 16;
            var tex = CreateTexture(W, H, Color.clear);

            // Stem: x=7, y=0 to 8
            for (int y = 0; y < 8; y++)
            {
                tex.SetPixel(7, y, ProceduralPalette.GrassGreenShadow);
            }
            // Small leaves on stem
            tex.SetPixel(6, 3, ProceduralPalette.GrassGreenBase);
            tex.SetPixel(8, 4, ProceduralPalette.GrassGreenBase);

            // Blossom: 3x3 petals around center at (7, 9)
            tex.SetPixel(7, 9, Color.white); // pistil center
            tex.SetPixel(6, 9, petalColor);
            tex.SetPixel(8, 9, petalColor);
            tex.SetPixel(7, 10, petalColor);
            tex.SetPixel(7, 8, petalColor);
            tex.SetPixel(6, 10, petalColor * 0.9f);
            tex.SetPixel(8, 10, petalColor * 0.9f);

            return CreateSpriteFromTex(tex, new Vector2(0.5f, 0.1f));
        }

        public static Sprite CreateRock(int seed = 808)
        {
            const int W = 20;
            const int H = 16;
            var tex = CreateTexture(W, H, Color.clear);

            for (int y = 1; y < 12; y++)
            {
                for (int x = 2; x < 18; x++)
                {
                    float dx = (x - 10) / 8f;
                    float dy = (y - 5) / 5f;
                    if (dx * dx + dy * dy <= 1.0f)
                    {
                        float noise = ProceduralPalette.Hash2D(x, y, seed);
                        Color c = (x > 10 || y > 5) ? ProceduralPalette.StoneGrayLight : ProceduralPalette.StoneGrayDark;
                        c = Color.Lerp(c, ProceduralPalette.StoneGrayDark, noise * 0.25f);
                        tex.SetPixel(x, y, c);
                    }
                }
            }
            return CreateSpriteFromTex(tex, new Vector2(0.5f, 0.2f));
        }

        public static Sprite CreateWoodenFence()
        {
            const int W = 24;
            const int H = 24;
            var tex = CreateTexture(W, H, Color.clear);

            // Left Post: x: 3 to 6, y: 0 to 18
            for (int y = 0; y <= 18; y++)
            {
                for (int x = 3; x <= 6; x++)
                {
                    tex.SetPixel(x, y, x <= 4 ? ProceduralPalette.WoodTrunkDark : ProceduralPalette.WoodPlankLight);
                }
            }
            // Right Post: x: 17 to 20, y: 0 to 18
            for (int y = 0; y <= 18; y++)
            {
                for (int x = 17; x <= 20; x++)
                {
                    tex.SetPixel(x, y, x <= 18 ? ProceduralPalette.WoodTrunkDark : ProceduralPalette.WoodPlankLight);
                }
            }
            // Horizontal rails: y=7 to 9 and y=13 to 15
            for (int x = 5; x <= 18; x++)
            {
                for (int y = 7; y <= 9; y++)
                    tex.SetPixel(x, y, ProceduralPalette.WoodPlankLight);
                for (int y = 13; y <= 15; y++)
                    tex.SetPixel(x, y, ProceduralPalette.WoodPlankDark);
            }
            return CreateSpriteFromTex(tex, new Vector2(0.5f, 0.1f));
        }
        #endregion

        #region Quest Board & Cyber Terminal Props
        /// <summary>
        /// Generates an in-world Quest Board post with parchment paper and golden notice.
        /// </summary>
        public static Sprite CreateQuestBoard()
        {
            const int W = 32;
            const int H = 40;
            var tex = CreateTexture(W, H, Color.clear);

            // Wooden support post: x: 14 to 17, y: 0 to 16
            for (int y = 0; y <= 16; y++)
            {
                for (int x = 14; x <= 17; x++)
                {
                    tex.SetPixel(x, y, (x <= 15) ? ProceduralPalette.WoodTrunkDark : ProceduralPalette.WoodTrunkLight);
                }
            }

            // Wooden Board backing: x: 4 to 27, y: 14 to 34
            for (int y = 14; y <= 34; y++)
            {
                for (int x = 4; x <= 27; x++)
                {
                    bool border = (x == 4 || x == 27 || y == 14 || y == 34);
                    tex.SetPixel(x, y, border ? ProceduralPalette.WoodTrunkDark : ProceduralPalette.WoodPlankLight);
                }
            }

            // Pinned Parchment Note: x: 7 to 24, y: 17 to 31
            for (int y = 17; y <= 31; y++)
            {
                for (int x = 7; x <= 24; x++)
                {
                    tex.SetPixel(x, y, new Color(0.92f, 0.88f, 0.76f)); // Aged paper
                }
            }

            // Golden exclamation pin at top of board (x: 14 to 17, y: 33 to 38)
            for (int y = 33; y <= 38; y++)
            {
                for (int x = 15; x <= 16; x++)
                {
                    tex.SetPixel(x, y, (y == 34) ? Color.clear : new Color(0.98f, 0.82f, 0.15f));
                }
            }

            // Text lines on parchment:
            for (int x = 9; x <= 22; x++)
            {
                tex.SetPixel(x, 28, new Color(0.40f, 0.32f, 0.22f));
                tex.SetPixel(x, 25, new Color(0.40f, 0.32f, 0.22f));
                if (x <= 18) tex.SetPixel(x, 22, new Color(0.40f, 0.32f, 0.22f));
            }

            return CreateSpriteFromTex(tex, new Vector2(0.5f, 0.15f));
        }

        /// <summary>
        /// Generates the Cyber Terminal Station: a blocky rugged field console with CRT display and status LEDs.
        /// </summary>
        public static Sprite CreateCyberTerminalStation()
        {
            const int W = 32;
            const int H = 40;
            var tex = CreateTexture(W, H, Color.clear);

            // Metal base pedestal: x: 8 to 23, y: 0 to 14
            for (int y = 0; y <= 14; y++)
            {
                for (int x = 8; x <= 23; x++)
                {
                    Color baseCol = (x < 16) ? ProceduralPalette.TerminalCasing * 0.8f : ProceduralPalette.TerminalCasing;
                    tex.SetPixel(x, y, baseCol);
                }
            }

            // Terminal CRT Monitor housing: x: 4 to 27, y: 14 to 34
            for (int y = 14; y <= 34; y++)
            {
                for (int x = 4; x <= 27; x++)
                {
                    bool border = (x == 4 || x == 27 || y == 14 || y == 34);
                    tex.SetPixel(x, y, border ? ProceduralPalette.TerminalCasing * 0.7f : ProceduralPalette.TerminalCasing);
                }
            }

            // Green Phosphor Screen: x: 7 to 24, y: 18 to 31
            for (int y = 18; y <= 31; y++)
            {
                for (int x = 7; x <= 24; x++)
                {
                    tex.SetPixel(x, y, ProceduralPalette.TerminalScreenOn);
                }
            }

            // Terminal prompt text pixels on screen:
            // ">_" cursor and prompt symbol in phosphor green
            tex.SetPixel(9, 28, ProceduralPalette.TerminalPhosphor);
            tex.SetPixel(10, 27, ProceduralPalette.TerminalPhosphor);
            tex.SetPixel(9, 26, ProceduralPalette.TerminalPhosphor);
            // Blinking cursor block:
            tex.SetPixel(13, 27, ProceduralPalette.TerminalPhosphor);
            tex.SetPixel(14, 27, ProceduralPalette.TerminalPhosphor);

            // Status LED indicators at base of screen
            tex.SetPixel(8, 16, ProceduralPalette.TerminalPhosphor); // Online (Green)
            tex.SetPixel(11, 16, ProceduralPalette.TerminalLedAlert);  // Audit active (Amber)
            tex.SetPixel(14, 16, new Color(0.25f, 0.65f, 0.95f));   // Network link (Cyan)

            // Small antenna on top right
            for (int y = 35; y <= 39; y++)
            {
                tex.SetPixel(23, y, ProceduralPalette.StoneGrayLight);
            }
            tex.SetPixel(23, 39, ProceduralPalette.FlowerRed); // Blinking red beacon

            return CreateSpriteFromTex(tex, new Vector2(0.5f, 0.15f));
        }
        #endregion

        #region Playable Adventurer Character
        /// <summary>
        /// Generates a distinct blocky adventurer sprite (16 wide x 24 high) with tunic, boots, hair and backpack.
        /// </summary>
        public static Sprite CreateAdventurerSprite(int frame = 0)
        {
            const int W = 16;
            const int H = 24;
            var tex = CreateTexture(W, H, Color.clear);

            // Animation offsets for walking frames:
            int legOffsetL = 0;
            int legOffsetR = 0;
            int bodyBob = 0;

            if (frame == 1) // Step Left
            {
                legOffsetL = 1;
                legOffsetR = -1;
                bodyBob = 1;
            }
            else if (frame == 2) // Step Right
            {
                legOffsetL = -1;
                legOffsetR = 1;
                bodyBob = 1;
            }

            int by = bodyBob;

            // Hair / Headgear: y: 16+by to 22+by, x: 4 to 11
            for (int y = 16 + by; y <= 22 + by; y++)
            {
                for (int x = 4; x <= 11; x++)
                {
                    tex.SetPixel(x, y, ProceduralPalette.AdventurerHair);
                }
            }

            // Face (front view): y: 15+by to 18+by, x: 5 to 10
            for (int y = 15 + by; y <= 18 + by; y++)
            {
                for (int x = 5; x <= 10; x++)
                {
                    tex.SetPixel(x, y, ProceduralPalette.AdventurerSkin);
                }
            }
            // Eyes: (6, 17+by) and (9, 17+by)
            tex.SetPixel(6, 17 + by, new Color(0.15f, 0.15f, 0.20f));
            tex.SetPixel(9, 17 + by, new Color(0.15f, 0.15f, 0.20f));

            // Torso / Tunic: y: 8+by to 14+by, x: 4 to 11
            for (int y = 8 + by; y <= 14 + by; y++)
            {
                for (int x = 4; x <= 11; x++)
                {
                    Color c = (x == 4 || x == 11) ? ProceduralPalette.AdventurerTunic * 0.85f : ProceduralPalette.AdventurerTunic;
                    tex.SetPixel(x, y, c);
                }
            }

            // Adventurer Belt: y: 8+by, x: 4 to 11
            for (int x = 4; x <= 11; x++)
            {
                tex.SetPixel(x, 8 + by, ProceduralPalette.AdventurerLeather);
            }
            tex.SetPixel(7, 8 + by, new Color(0.92f, 0.78f, 0.20f)); // Gold buckle

            // Backpack peeking out on left shoulder:
            for (int y = 10 + by; y <= 14 + by; y++)
            {
                tex.SetPixel(3, y, ProceduralPalette.SoilBrownDark);
            }

            // Left Leg: x: 5 to 6, y: 0 to 7
            for (int y = Mathf.Max(0, 0 + legOffsetL); y <= 7 + by; y++)
            {
                for (int x = 5; x <= 6; x++)
                {
                    Color c = (y <= 2 + legOffsetL) ? ProceduralPalette.AdventurerLeather : ProceduralPalette.SoilBrownDark;
                    tex.SetPixel(x, y, c);
                }
            }

            // Right Leg: x: 9 to 10, y: 0 to 7
            for (int y = Mathf.Max(0, 0 + legOffsetR); y <= 7 + by; y++)
            {
                for (int x = 9; x <= 10; x++)
                {
                    Color c = (y <= 2 + legOffsetR) ? ProceduralPalette.AdventurerLeather : ProceduralPalette.SoilBrownDark;
                    tex.SetPixel(x, y, c);
                }
            }

            return CreateSpriteFromTex(tex, new Vector2(0.5f, 0.1f));
        }
        #endregion
    }
}
