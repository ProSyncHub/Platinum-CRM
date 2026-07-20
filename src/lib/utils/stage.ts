// src/lib/utils/stage.ts

import { stages } from "@/lib/constants/stages";

export const getStageLabel = (
  value: string
) => {
  return (
    stages.find(
      (stage) => stage.value === value
    )?.label || value
  );
};