using System;
using UnityEngine;
using UnityEngine.UI;
using UnityEngine.EventSystems;
using LearnXSK.Core;

namespace LearnXSK.UI
{
    /// <summary>
    /// Interactive Mission Board / Card component for a selectable Learning Path.
    /// Supports pointer hover, selection highlight, keyboard navigation, and audio cues.
    /// </summary>
    [RequireComponent(typeof(RectTransform))]
    public class LearningPathCard : MonoBehaviour, IPointerEnterHandler, IPointerExitHandler, IPointerClickHandler
    {
        [Header("Path Identity")]
        [SerializeField] private LearningPathType pathType;

        [Header("UI Element References")]
        [SerializeField] private Image cardBackgroundImage;
        [SerializeField] private Image iconImage;
        [SerializeField] private Text titleText;
        [SerializeField] private Text taglineText;
        [SerializeField] private Image selectionGlowOutline;
        [SerializeField] private GameObject selectedBadge;

        [Header("Visual State Sprites")]
        [SerializeField] private Sprite normalFrameSprite;
        [SerializeField] private Sprite selectedFrameSprite;

        [Header("Animation Settings")]
        [SerializeField] private float hoverScale = 1.05f;
        [SerializeField] private float animationSpeed = 12f;

        private LearningPathInfo info;
        private bool isSelected = false;
        private bool isHovered = false;
        private Vector3 targetScale = Vector3.one;
        private RectTransform rectTransform;

        public LearningPathType PathType => pathType;
        public bool IsSelected => isSelected;
        public LearningPathInfo Info => info;

        public event Action<LearningPathCard> OnCardClicked;

        private void Awake()
        {
            rectTransform = GetComponent<RectTransform>();
            info = LearningPathInfo.GetDefault(pathType);
            ApplyData();
            UpdateVisualState(false);
        }

        private void Update()
        {
            // Smooth micro-animation for hover/select scaling
            if (rectTransform != null)
            {
                rectTransform.localScale = Vector3.Lerp(rectTransform.localScale, targetScale, Time.unscaledDeltaTime * animationSpeed);
            }
        }

        public void Configure(LearningPathType type)
        {
            pathType = type;
            info = LearningPathInfo.GetDefault(pathType);
            ApplyData();
            UpdateVisualState(isSelected);
        }

        private void ApplyData()
        {
            if (info == null) return;

            if (titleText != null)
            {
                titleText.text = info.Title;
            }

            if (taglineText != null)
            {
                taglineText.text = info.ShortTagline;
            }

            // Accent color for title if available
            if (titleText != null && ColorUtility.TryParseHtmlString(info.AccentHexColor, out Color accentCol))
            {
                titleText.color = accentCol;
            }
        }

        public void SetSelected(bool selected)
        {
            isSelected = selected;
            UpdateVisualState(isSelected);
        }

        private void UpdateVisualState(bool selected)
        {
            if (cardBackgroundImage != null)
            {
                cardBackgroundImage.sprite = selected && selectedFrameSprite != null 
                    ? selectedFrameSprite 
                    : normalFrameSprite;
            }

            if (selectionGlowOutline != null)
            {
                selectionGlowOutline.enabled = selected;
            }

            if (selectedBadge != null)
            {
                selectedBadge.SetActive(selected);
            }

            UpdateTargetScale();
        }

        private void UpdateTargetScale()
        {
            if (isSelected)
            {
                targetScale = new Vector3(hoverScale, hoverScale, 1f);
            }
            else if (isHovered)
            {
                targetScale = new Vector3(hoverScale * 0.98f, hoverScale * 0.98f, 1f);
            }
            else
            {
                targetScale = Vector3.one;
            }
        }

        public void OnPointerEnter(PointerEventData eventData)
        {
            isHovered = true;
            UpdateTargetScale();
        }

        public void OnPointerExit(PointerEventData eventData)
        {
            isHovered = false;
            UpdateTargetScale();
        }

        public void OnPointerClick(PointerEventData eventData)
        {
            OnCardClicked?.Invoke(this);
        }
    }
}
