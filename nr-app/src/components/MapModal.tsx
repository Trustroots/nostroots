import { useAppSelector } from "@/redux/hooks";
import { mapSelectors } from "@/redux/slices/map.slice";
import { Modal, Text, View } from "react-native";

export default function MapModal() {
  const showModal = useAppSelector(mapSelectors.selectIsMapModalOpen);

  return (
    <Modal visible={showModal}>
      <View>
        <Text>Modal is under development</Text>
      </View>
    </Modal>
  );
}
