'use client';
import React from 'react';
import { ProgressStages as ProgressStagesUI } from './ui/progress';

const ProgressStages = ({ currentStage }) => {
  return (
    <div className="w-full max-w-2xl mx-auto">
      <ProgressStagesUI currentStage={currentStage} />
    </div>
  );
};

export default ProgressStages;
