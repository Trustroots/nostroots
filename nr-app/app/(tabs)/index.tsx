import ErrorBoundary from "@/components/ErrorBoundary";
import Map from "@/components/Map";

export default function HomeScreen() {
  return (
    <ErrorBoundary>
      <Map />
    </ErrorBoundary>
  );
}
