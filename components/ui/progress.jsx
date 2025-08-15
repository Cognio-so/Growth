"use client"

import * as React from "react"
import { motion } from "framer-motion"
import { cn } from "../../lib/utils"

const ProgressStages = ({ currentStage, className, ...props }) => {
  const stages = [
    { id: 'scraping', label: 'Scraping', description: 'Gathering website content and structure' },
    { id: 'gathering', label: 'Gathering Content', description: 'Analyzing and organizing content' },
    { id: 'guidelines', label: 'Following Growth 99 Guidelines', description: 'Applying UI/UX design principles' },
    { id: 'generating', label: 'Generating Content', description: 'Creating React components and code' },
    { id: 'applying', label: 'Applying', description: 'Deploying code to sandbox' },
    { id: 'ready', label: 'Ready', description: 'Your app is ready to view' }
  ];

  const currentIndex = stages.findIndex(stage => stage.id === currentStage);
  const isActive = (index) => index === currentIndex;
  const isCompleted = (index) => index < currentIndex;

  return (
    <div className={cn("w-full max-w-md mx-auto", className)} {...props}>
      {/* Main Progress Display */}
      <div className="text-center mb-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="w-8 h-8 border-2 border-white border-t-transparent rounded-full"
          />
        </motion.div>
        
        <motion.h3
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-xl font-semibold text-white mb-2"
        >
          {stages[currentIndex]?.label || 'Processing...'}
        </motion.h3>
        
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="text-gray-300 text-sm"
        >
          {stages[currentIndex]?.description || 'Please wait while we process your request'}
        </motion.p>
      </div>

      {/* Simple Progress Steps */}
      <div className="space-y-2">
        {stages.map((stage, index) => (
          <motion.div
            key={stage.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
            className={cn(
              "flex items-center space-x-3 p-2 rounded-lg transition-all duration-300",
              isCompleted(index) && "bg-green-500/10 border border-green-500/20",
              isActive(index) && "bg-blue-500/10 border border-blue-500/20",
              !isCompleted(index) && !isActive(index) && "bg-gray-500/10 border border-gray-500/20"
            )}
          >
            {/* Step Indicator */}
            <div className={cn(
              "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-all duration-300",
              isCompleted(index) && "bg-green-500 text-white",
              isActive(index) && "bg-blue-500 text-white",
              !isCompleted(index) && !isActive(index) && "bg-gray-600 text-gray-400"
            )}>
              {isCompleted(index) ? (
                <motion.svg
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.2 }}
                  className="w-3 h-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </motion.svg>
              ) : (
                index + 1
              )}
            </div>

            {/* Step Content */}
            <div className="flex-1 min-w-0">
              <div className={cn(
                "font-medium text-sm transition-colors duration-300",
                isCompleted(index) && "text-green-400",
                isActive(index) && "text-white",
                !isCompleted(index) && !isActive(index) && "text-gray-400"
              )}>
                {stage.label}
              </div>
            </div>

            {/* Status */}
            {isActive(index) && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center space-x-1"
              >
                <motion.div
                  className="w-1.5 h-1.5 bg-blue-400 rounded-full"
                  animate={{ scale: [1, 1.5, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                />
                <span className="text-xs text-blue-400">Active</span>
              </motion.div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Progress Percentage */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="text-center mt-6"
      >
        <div className="text-2xl font-bold text-white">
          {Math.round(((currentIndex + 1) / stages.length) * 100)}%
        </div>
        <div className="text-xs text-gray-400 mt-1">
          Step {currentIndex + 1} of {stages.length}
        </div>
      </motion.div>
    </div>
  );
};

// Keep the original Progress component for backward compatibility
function Progress({
  className,
  value,
  ...props
}) {
  return (
    <div
      data-slot="progress"
      className={cn(
        "bg-primary/20 relative h-2 w-full overflow-hidden rounded-full",
        className
      )}
      {...props}>
      <div
        data-slot="progress-indicator"
        className="bg-primary h-full w-full flex-1 transition-all"
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }} />
    </div>
  );
}

export { Progress, ProgressStages }
