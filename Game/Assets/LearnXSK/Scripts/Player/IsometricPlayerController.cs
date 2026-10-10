using UnityEngine;
using LearnXSK.World;

namespace LearnXSK.Player
{
    [RequireComponent(typeof(Rigidbody2D))]
    [RequireComponent(typeof(CircleCollider2D))]
    public class IsometricPlayerController : MonoBehaviour
    {
        [Header("Movement Settings")]
        public float walkSpeed = 3.5f;
        public float runSpeed = 5.5f;

        [Header("Interaction")]
        public float interactionRange = 1.8f;

        private Rigidbody2D _rb;
        private SpriteRenderer _sr;
        private Vector2 _moveInput;
        private bool _isRunning;

        // Animation state
        private float _animTimer;
        private int _currentFrame = 0;
        private Sprite[] _animFrames;

        // Interaction Targets
        public System.Action OnInteractQuestBoard;
        public System.Action OnInteractTerminal;
        public string NearbyInteractablePrompt { get; private set; } = "";

        private Transform _questBoardTransform;
        private Transform _terminalTransform;

        private void Awake()
        {
            _rb = GetComponent<Rigidbody2D>();
            _rb.gravityScale = 0f;
            _rb.freezeRotation = true;
            _rb.interpolation = RigidbodyInterpolation2D.Interpolate;

            var col = GetComponent<CircleCollider2D>();
            col.radius = 0.25f;
            col.offset = new Vector2(0f, 0.1f);

            _sr = GetComponent<SpriteRenderer>();
            if (_sr == null)
            {
                _sr = gameObject.AddComponent<SpriteRenderer>();
            }
            _sr.sortingOrder = 100; // Will be dynamically sorted by Y

            // Cache character animation frames
            _animFrames = new Sprite[3];
            _animFrames[0] = ProceduralSpriteGenerator.GetSprite("player_idle", () => ProceduralSpriteGenerator.CreateAdventurerSprite(0));
            _animFrames[1] = ProceduralSpriteGenerator.GetSprite("player_walk1", () => ProceduralSpriteGenerator.CreateAdventurerSprite(1));
            _animFrames[2] = ProceduralSpriteGenerator.GetSprite("player_walk2", () => ProceduralSpriteGenerator.CreateAdventurerSprite(2));
            _sr.sprite = _animFrames[0];
        }

        private void Start()
        {
            // Find world interactive targets if not set
            var qb = GameObject.Find("QuestBoard") ?? GameObject.FindWithTag("QuestBoard");
            if (qb != null) _questBoardTransform = qb.transform;

            var term = GameObject.Find("CyberTerminalStation") ?? GameObject.FindWithTag("TerminalStation");
            if (term != null) _terminalTransform = term.transform;
        }

        private void Update()
        {
            // Input handling
            float h = Input.GetAxisRaw("Horizontal");
            float v = Input.GetAxisRaw("Vertical");
            _moveInput = new Vector2(h, v).normalized;
            _isRunning = Input.GetKey(KeyCode.LeftShift) || Input.GetKey(KeyCode.RightShift);

            // Sprite facing direction
            if (h < -0.01f) _sr.flipX = true;
            else if (h > 0.01f) _sr.flipX = false;

            // Sorting order based on Y position (isometric depth)
            _sr.sortingOrder = Mathf.RoundToInt(-transform.position.y * 100);

            // Walking / Running sprite animation
            UpdateAnimation();

            // Interaction checks
            CheckInteractionRange();

            if (Input.GetKeyDown(KeyCode.E))
            {
                TriggerInteraction();
            }
        }

        private void FixedUpdate()
        {
            float speed = _isRunning ? runSpeed : walkSpeed;
            _rb.linearVelocity = _moveInput * speed;
        }

        private void UpdateAnimation()
        {
            if (_moveInput.sqrMagnitude > 0.01f)
            {
                float stepInterval = _isRunning ? 0.12f : 0.18f;
                _animTimer += Time.deltaTime;
                if (_animTimer >= stepInterval)
                {
                    _animTimer = 0f;
                    _currentFrame = (_currentFrame == 1) ? 2 : 1;
                    _sr.sprite = _animFrames[_currentFrame];
                }
            }
            else
            {
                _animTimer = 0f;
                _currentFrame = 0;
                _sr.sprite = _animFrames[0];
            }
        }

        private void CheckInteractionRange()
        {
            NearbyInteractablePrompt = "";

            if (_questBoardTransform != null)
            {
                float dist = Vector2.Distance(transform.position, _questBoardTransform.position);
                if (dist <= interactionRange)
                {
                    NearbyInteractablePrompt = "Press [E] to read Quest Board";
                    return;
                }
            }

            if (_terminalTransform != null)
            {
                float dist = Vector2.Distance(transform.position, _terminalTransform.position);
                if (dist <= interactionRange)
                {
                    NearbyInteractablePrompt = "Press [E] to access Cyber Terminal";
                    return;
                }
            }
        }

        private void TriggerInteraction()
        {
            if (_questBoardTransform != null && Vector2.Distance(transform.position, _questBoardTransform.position) <= interactionRange)
            {
                OnInteractQuestBoard?.Invoke();
            }
            else if (_terminalTransform != null && Vector2.Distance(transform.position, _terminalTransform.position) <= interactionRange)
            {
                OnInteractTerminal?.Invoke();
            }
        }

        public void SetTargets(Transform questBoard, Transform terminal)
        {
            _questBoardTransform = questBoard;
            _terminalTransform = terminal;
        }
    }
}
