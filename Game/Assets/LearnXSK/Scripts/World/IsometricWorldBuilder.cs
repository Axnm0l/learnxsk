using UnityEngine;

namespace LearnXSK.World
{
    /// <summary>
    /// Builds the rich 2D isometric Minecraft-inspired block-world environment at runtime.
    /// Creates terrain, paths, foliage, trees, outpost fences, quest board, and terminal station.
    /// </summary>
    public class IsometricWorldBuilder : MonoBehaviour
    {
        [Header("World Dimensions")]
        public int mapWidth = 20;
        public int mapHeight = 16;
        public int seed = 1337;

        [Header("Prefabs / References")]
        public Transform questBoardTransform;
        public Transform terminalTransform;
        public Transform playerTransform;

        private void Awake()
        {
            BuildWorld();
        }

        public void BuildWorld()
        {
            // Isometric tile conversion parameters
            // With PPU=32, a 32x32 isometric sprite has top diamond width=1.0 world units, height=0.5 world units
            const float tileStepX = 0.5f;
            const float tileStepY = 0.25f;

            var terrainParent = new GameObject("TerrainTiles").transform;
            terrainParent.SetParent(transform);

            var propsParent = new GameObject("PropsAndFoliage").transform;
            propsParent.SetParent(transform);

            // Cached sprites
            Sprite grassSprite = ProceduralSpriteGenerator.GetSprite("tile_grass", () => ProceduralSpriteGenerator.CreateGrassBlock(seed));
            Sprite pathSprite  = ProceduralSpriteGenerator.GetSprite("tile_path",  () => ProceduralSpriteGenerator.CreateDirtPathBlock(seed));
            Sprite stoneSprite = ProceduralSpriteGenerator.GetSprite("tile_stone", () => ProceduralSpriteGenerator.CreateStoneBlock(seed));
            Sprite woodSprite  = ProceduralSpriteGenerator.GetSprite("tile_wood",  () => ProceduralSpriteGenerator.CreateWoodPlankBlock(seed));

            Sprite treeSprite  = ProceduralSpriteGenerator.GetSprite("prop_tree",  () => ProceduralSpriteGenerator.CreateIsometricTree(seed));
            Sprite rockSprite  = ProceduralSpriteGenerator.GetSprite("prop_rock",  () => ProceduralSpriteGenerator.CreateRock(seed));
            Sprite fenceSprite = ProceduralSpriteGenerator.GetSprite("prop_fence", () => ProceduralSpriteGenerator.CreateWoodenFence());
            Sprite tuftSprite  = ProceduralSpriteGenerator.GetSprite("prop_tuft",  () => ProceduralSpriteGenerator.CreateGrassTuft(seed));
            Sprite redFlower   = ProceduralSpriteGenerator.GetSprite("prop_flower_red", () => ProceduralSpriteGenerator.CreateFlower(ProceduralPalette.FlowerRed, seed));
            Sprite yellowFlower = ProceduralSpriteGenerator.GetSprite("prop_flower_yellow", () => ProceduralSpriteGenerator.CreateFlower(ProceduralPalette.FlowerYellow, seed + 1));

            // Outpost center around grid (14, 11)
            int outpostMinX = 11, outpostMaxX = 16;
            int outpostMinY = 9, outpostMaxY = 13;

            // 1. Generate Terrain Tiles
            for (int gx = 0; gx < mapWidth; gx++)
            {
                for (int gy = 0; gy < mapHeight; gy++)
                {
                    float wx = (gx - gy) * tileStepX;
                    float wy = (gx + gy) * tileStepY;
                    Vector3 tilePos = new Vector3(wx, wy, 0f);

                    // Path check: S-curved trail from spawn (4, 4) to outpost (12, 10)
                    bool isPath = IsPathTile(gx, gy);
                    bool isOutpost = (gx >= outpostMinX && gx <= outpostMaxX && gy >= outpostMinY && gy <= outpostMaxY);

                    Sprite selectedTileSprite = grassSprite;
                    if (isOutpost)
                    {
                        selectedTileSprite = ((gx + gy) % 2 == 0) ? stoneSprite : woodSprite;
                    }
                    else if (isPath)
                    {
                        selectedTileSprite = pathSprite;
                    }

                    var tileGO = new GameObject($"Tile_{gx}_{gy}");
                    tileGO.transform.position = tilePos;
                    tileGO.transform.SetParent(terrainParent);

                    var sr = tileGO.AddComponent<SpriteRenderer>();
                    sr.sprite = selectedTileSprite;
                    // Strict depth sorting for isometric tiles
                    sr.sortingOrder = Mathf.RoundToInt(-wy * 100) - 500;

                    // 2. Add Foliage & Scenery on natural grass
                    if (!isPath && !isOutpost)
                    {
                        bool isBorder = (gx == 0 || gx == mapWidth - 1 || gy == 0 || gy == mapHeight - 1);
                        if (isBorder)
                        {
                            // Perimeter Tree with collider
                            SpawnTree(tilePos, treeSprite, propsParent);
                        }
                        else
                        {
                            float noise = ProceduralPalette.Hash2D(gx, gy, seed + 50);
                            if (noise > 0.88f)
                            {
                                SpawnTree(tilePos, treeSprite, propsParent);
                            }
                            else if (noise > 0.78f)
                            {
                                SpawnProp(tilePos, rockSprite, propsParent, true);
                            }
                            else if (noise > 0.65f)
                            {
                                SpawnProp(tilePos, (noise > 0.72f) ? redFlower : yellowFlower, propsParent, false);
                            }
                            else if (noise > 0.45f)
                            {
                                SpawnProp(tilePos, tuftSprite, propsParent, false);
                            }
                        }
                    }
                }
            }

            // 3. Outpost Enclosure Fences
            for (int gx = outpostMinX; gx <= outpostMaxX; gx++)
            {
                if (gx == 13) continue; // Entrance gap on southern perimeter
                Vector3 fPos = new Vector3((gx - outpostMinY) * tileStepX, (gx + outpostMinY) * tileStepY, 0f);
                SpawnFence(fPos, fenceSprite, propsParent);
            }
            for (int gy = outpostMinY; gy <= outpostMaxY; gy++)
            {
                Vector3 fPosL = new Vector3((outpostMinX - gy) * tileStepX, (outpostMinX + gy) * tileStepY, 0f);
                SpawnFence(fPosL, fenceSprite, propsParent);
                Vector3 fPosR = new Vector3((outpostMaxX - gy) * tileStepX, (outpostMaxX + gy) * tileStepY, 0f);
                SpawnFence(fPosR, fenceSprite, propsParent);
            }

            // 4. Place Quest Board at entrance
            Vector3 qbPos = new Vector3((12 - 10) * tileStepX, (12 + 10) * tileStepY + 0.1f, 0f);
            var qbGO = new GameObject("QuestBoard");
            qbGO.tag = "QuestBoard";
            qbGO.transform.position = qbPos;
            qbGO.transform.SetParent(propsParent);
            var qbSR = qbGO.AddComponent<SpriteRenderer>();
            qbSR.sprite = ProceduralSpriteGenerator.GetSprite("prop_quest_board", ProceduralSpriteGenerator.CreateQuestBoard);
            qbSR.sortingOrder = Mathf.RoundToInt(-qbPos.y * 100);
            var qbCol = qbGO.AddComponent<BoxCollider2D>();
            qbCol.size = new Vector2(0.8f, 0.4f);
            qbCol.offset = new Vector2(0f, 0.15f);
            questBoardTransform = qbGO.transform;

            // 5. Place Cyber Terminal Station inside Outpost
            Vector3 termPos = new Vector3((14 - 12) * tileStepX, (14 + 12) * tileStepY + 0.1f, 0f);
            var termGO = new GameObject("CyberTerminalStation");
            termGO.tag = "TerminalStation";
            termGO.transform.position = termPos;
            termGO.transform.SetParent(propsParent);
            var termSR = termGO.AddComponent<SpriteRenderer>();
            termSR.sprite = ProceduralSpriteGenerator.GetSprite("prop_terminal_station", ProceduralSpriteGenerator.CreateCyberTerminalStation);
            termSR.sortingOrder = Mathf.RoundToInt(-termPos.y * 100);
            var termCol = termGO.AddComponent<BoxCollider2D>();
            termCol.size = new Vector2(0.8f, 0.4f);
            termCol.offset = new Vector2(0f, 0.15f);
            terminalTransform = termGO.transform;

            // 6. Spawn Player at clearing
            Vector3 spawnPos = new Vector3((5 - 4) * tileStepX, (5 + 4) * tileStepY, 0f);
            var playerGO = GameObject.Find("Player");
            if (playerGO != null)
            {
                playerGO.transform.position = spawnPos;
                var pc = playerGO.GetComponent<Player.IsometricPlayerController>();
                if (pc != null) pc.SetTargets(questBoardTransform, terminalTransform);
            }
        }

        private bool IsPathTile(int gx, int gy)
        {
            // S-curve connector from (4, 4) to (12, 10)
            if (gx >= 3 && gx <= 6 && gy == 4) return true;
            if (gx == 6 && gy >= 4 && gy <= 7) return true;
            if (gx >= 6 && gx <= 10 && gy == 7) return true;
            if (gx == 10 && gy >= 7 && gy <= 10) return true;
            if (gx >= 10 && gx <= 13 && gy == 10) return true;
            return false;
        }

        private void SpawnTree(Vector3 pos, Sprite sprite, Transform parent)
        {
            var go = new GameObject("Tree");
            go.transform.position = pos;
            go.transform.SetParent(parent);
            var sr = go.AddComponent<SpriteRenderer>();
            sr.sprite = sprite;
            sr.sortingOrder = Mathf.RoundToInt(-pos.y * 100);
            var col = go.AddComponent<CircleCollider2D>();
            col.radius = 0.28f;
            col.offset = new Vector2(0f, 0.1f);
        }

        private void SpawnFence(Vector3 pos, Sprite sprite, Transform parent)
        {
            var go = new GameObject("Fence");
            go.transform.position = pos;
            go.transform.SetParent(parent);
            var sr = go.AddComponent<SpriteRenderer>();
            sr.sprite = sprite;
            sr.sortingOrder = Mathf.RoundToInt(-pos.y * 100);
            var col = go.AddComponent<BoxCollider2D>();
            col.size = new Vector2(0.6f, 0.3f);
            col.offset = new Vector2(0f, 0.1f);
        }

        private void SpawnProp(Vector3 pos, Sprite sprite, Transform parent, bool hasCollider)
        {
            var go = new GameObject("Prop");
            go.transform.position = pos;
            go.transform.SetParent(parent);
            var sr = go.AddComponent<SpriteRenderer>();
            sr.sprite = sprite;
            sr.sortingOrder = Mathf.RoundToInt(-pos.y * 100);
            if (hasCollider)
            {
                var col = go.AddComponent<CircleCollider2D>();
                col.radius = 0.18f;
                col.offset = new Vector2(0f, 0.05f);
            }
        }
    }
}
