import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { mapActions, mapSelectors } from "@/redux/slices/map.slice";
import { Button, Modal, Text, View } from "react-native";

export default function MapModal() {
  const dispatch = useAppDispatch();
  const showModal = useAppSelector(mapSelectors.selectIsMapModalOpen);

  return (
    <Modal visible={showModal}>
      <View>
        <Text>Modal is under development</Text>
        <Button
          title="Close"
          onPress={() => {
            dispatch(mapActions.closeMapModal());
          }}
        />
      </View>
    </Modal>
  );
}
