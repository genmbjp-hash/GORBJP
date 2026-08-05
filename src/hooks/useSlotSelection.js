// src/hooks/useSlotSelection.js

import { useState } from 'react'

export function useSlotSelection() {
  const [selectedSlots, setSelectedSlots] = useState([])

  /**
   * Toggle a slot — slots must be consecutive
   */
  function toggleSlot(slot) {
    const index = selectedSlots.findIndex(s => s.hour === slot.hour)

    // If already selected, remove this and all after it
    if (index >= 0) {
      setSelectedSlots(selectedSlots.slice(0, index))
      return
    }

    // If no slots selected, select this one
    if (selectedSlots.length === 0) {
      setSelectedSlots([slot])
      return
    }

    // Check if this slot is consecutive to the last selected
    const lastSlot = selectedSlots[selectedSlots.length - 1]
    const isConsecutive = slot.hour === lastSlot.hour + 1

    if (isConsecutive) {
      setSelectedSlots([...selectedSlots, slot])
    } else {
      // Reset selection
      setSelectedSlots([slot])
    }
  }

  /**
   * Clear all selected slots
   */
  function clearSelection() {
    setSelectedSlots([])
  }

  /**
   * Get selected range
   */
  function getSelectedRange() {
    if (selectedSlots.length === 0) return null

    const sorted = [...selectedSlots].sort((a, b) => a.hour - b.hour)
    return {
      start: sorted[0].startTime,
      end: sorted[sorted.length - 1].endTime,
      duration: sorted.length,
      hours: sorted.map(s => s.hour),
    }
  }

  /**
   * Check if a slot is selected
   */
  function isSelected(slot) {
    return selectedSlots.some(s => s.hour === slot.hour)
  }

  return {
    selectedSlots,
    toggleSlot,
    clearSelection,
    getSelectedRange,
    isSelected,
  }
}
