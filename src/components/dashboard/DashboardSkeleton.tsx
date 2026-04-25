import { motion } from "framer-motion";
import { fadeUpVariant, bentoCardVariant, bentoContainerVariant } from "@/lib/motion";
import { Shimmer } from "@/components/ui/shimmer";
import { DynamicLoader } from "@/components/ui/DynamicLoader";

export function DashboardSkeleton() {
  return (
    <div className="relative min-h-[80vh]">
      <div className="absolute inset-0 z-10 flex items-center justify-center -mt-20">
        <DynamicLoader 
          phrases={[
            "Fetching interview history...", 
            "Loading analytics engine...", 
            "Preparing personalized insights..."
          ]} 
        />
      </div>
      <div className="opacity-40 pointer-events-none">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={bentoContainerVariant}
          className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8"
        >
          <motion.div variants={bentoCardVariant} className="md:col-span-4 min-h-[360px]">
            <Shimmer className="w-full h-full rounded-[24px]" />
          </motion.div>
          <motion.div variants={bentoCardVariant} className="md:col-span-8 lg:col-span-4 min-h-[360px]">
            <Shimmer className="w-full h-full rounded-[24px]" />
          </motion.div>
          <motion.div variants={bentoCardVariant} className="md:col-span-12 lg:col-span-4 min-h-[360px]">
            <Shimmer className="w-full h-full rounded-[24px]" />
          </motion.div>
          <motion.div variants={bentoCardVariant} className="md:col-span-12 min-h-[200px]">
            <Shimmer className="w-full h-full rounded-[24px]" />
          </motion.div>
        </motion.div>

      <motion.div variants={fadeUpVariant} className="pt-12">
        <div className="mb-12 flex justify-between items-end">
          <div>
            <Shimmer className="w-[250px] h-[48px] rounded-xl mb-4" />
            <Shimmer className="w-[300px] h-[20px] rounded-lg" />
          </div>
        </div>
        <div className="flex flex-col gap-6">
          {[1, 2, 3].map((i) => (
            <motion.div
              key={i}
              variants={bentoCardVariant}
              className="h-[140px] w-full"
            >
              <Shimmer className="w-full h-full rounded-[2.5rem]" />
            </motion.div>
          ))}
        </div>
      </motion.div>
      </div>
    </div>
  );
}
