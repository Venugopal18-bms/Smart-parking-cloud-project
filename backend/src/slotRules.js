export const vehicleTypes = ["two_wheeler", "three_wheeler", "four_wheeler"];

export function getSlotAllocation(capacity) {
  const twoWheeler = Math.max(Math.floor(capacity * 0.28), 1);
  const threeWheeler = Math.max(Math.floor(capacity * 0.12), 1);
  const fourWheeler = capacity - twoWheeler - threeWheeler;

  return [
    { type: "two_wheeler", label: "Two Wheeler", start: 1, end: twoWheeler },
    {
      type: "three_wheeler",
      label: "Three Wheeler",
      start: twoWheeler + 1,
      end: twoWheeler + threeWheeler
    },
    {
      type: "four_wheeler",
      label: "Four Wheeler",
      start: twoWheeler + threeWheeler + 1,
      end: capacity
    }
  ];
}

export function getSlotType(capacity, slotNumber) {
  return getSlotAllocation(capacity).find(
    (section) => slotNumber >= section.start && slotNumber <= section.end
  );
}
